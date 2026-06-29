import { db, usersTable, roomUsersTable, giftLogTable, pool } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { checkNickname } from './nicknameFilter';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logEvent } from './monitoring';
// 인메모리 게임 상태 관리 + PostgreSQL 영속화

// ── 총관리자 / 부운영진 설정 ───────────────────────
const ADMIN_USER_IDS = new Set([
  "ff26b9405734fbc4958a4b3f1e47fa8eef4f2b1b201aba6572507f2e8405b00fe5", // 운영 채널
  "ffcd5de0d94f2ed666fa7b44ad3cecda934f2b1b201aba6572507f2e8405b00fe5", // 개발 채널
]);
const ADMIN_NICKNAME = "운영진_혁도동";

export function isAdminUser(userId: string): boolean {
  return ADMIN_USER_IDS.has(userId);
}

const SUB_ADMIN_NICKNAMES = new Map([
  ["46a1129649a275ec5426165c4ea53c63a370e8eb6f375c9e8bb59ce33776f27c4c", "부운영진_서우진"],
  ["ba272cdce0d09b64cda8aa326c65e586c8c05da90be8b2d2713514a77539351603", "최고후원자_정지원"],
]);

export function isSubAdminUser(userId: string): boolean {
  return SUB_ADMIN_NICKNAMES.has(userId);
}

/** 운영진/부운영진이면 고정 닉네임 반환, 일반 유저면 undefined */
export function getFixedNickname(userId: string): string | undefined {
  if (ADMIN_USER_IDS.has(userId)) return ADMIN_NICKNAME;
  return SUB_ADMIN_NICKNAMES.get(userId);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Quiz {
  id: number;
  answer: string;
  chosung: string;
  category: string;
  alternateAnswers?: string[];
  attemptCount: number;
  correctCount: number;
}

export interface UserScore {
  userId: string;
  nickname: string;
  score: number;
  correct: number;
  total: number;
  hunminWins:          number;
  hunminMax:           number;
  hunminTotal:         number;
  relicInvLimit:       number;
  jamoStreak:          number;
  lastJamoDate:        string;
  jamoBestStreak:      number;
  jamoTotalCount:      number;
  jamoEasyCount:       number;
  jamoNormalCount:     number;
  jamoHardCount:       number;
  lastJamoAt:          string;
}

export interface GameSession {
  roomId: string;
  userId: string;
  mode: 'chosung' | 'hunmin';
  currentQuizId: number;
  score: number;
  correct: number;
  total: number;
  startedAt: Date;
  lastActivityAt: Date;
  currentWrong: number;
  questionStartedAt: Date;
  hintsUsed: number;
  currentPts: number;             // 정답 시 획득 파편 (7500P/3750P에서 시작, 오답마다 40~100 랜덤 감소)
  revealedKoreanIndices: number[]; // 힌트로 공개된 한글 음절 인덱스 목록
  quizCategory?: string;           // 주제선택 시 해당 카테고리 (없으면 전체 랜덤)
  ended?: boolean;                 // 게임이 종료됐지만 다음문제를 위해 세션 유지 중
  lastCreditedQuizId?: number;     // 이중 처리 방지: 마지막으로 포인트가 부여된 퀴즈 ID
}

// ── 초성 힌트 유틸 ─────────────────────────────────
const CHOSUNG_LIST = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 한 글자를 초성으로 변환 (한글 아니면 원문 그대로)
export function getChosung(char: string): string {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return char;
  const idx = Math.floor((code - 0xAC00) / (21 * 28));
  return CHOSUNG_LIST[idx];
}

// 기존 순서 기반 힌트 (하위 호환 유지)
export function buildHintDisplay(answer: string, revealCount: number): string {
  const chars = Array.from(answer);
  const safeReveal = Math.min(revealCount, chars.length - 1);
  return chars.map((c, i) => (i < safeReveal ? c : getChosung(c))).join('');
}

// ── 새 힌트 유틸 (랜덤 공개, 비한글 문자 처리) ──────────────────

// 한글 음절인지 (AC00-D7A3)
export function isKoreanSyllable(c: string): boolean {
  const code = c.charCodeAt(0);
  return code >= 0xAC00 && code <= 0xD7A3;
}

// 정답 문자열에서 한글 음절에 해당하는 인덱스 목록 반환
export function getKoreanCharIndices(answer: string): number[] {
  return Array.from(answer)
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => isKoreanSyllable(c))
    .map(({ i }) => i);
}

// 힌트 최대 횟수: 한글 4자 이상 → (한글수 - 2), 2~3자 → (한글수 - 1), 1자 → 0
export function calcMaxHints(answer: string): number {
  const korCount = getKoreanCharIndices(answer).length;
  if (korCount <= 1) return 0;
  if (korCount <= 3) return korCount - 1;
  return korCount - 2;
}

// 랜덤 힌트 표시: revealedIndices에 있는 위치는 원문, 나머지 한글은 초성, 비한글은 그대로
export function buildHintDisplayRandom(answer: string, revealedIndices: Set<number>): string {
  return Array.from(answer)
    .map((c, i) => {
      if (!isKoreanSyllable(c)) return c; // 숫자·콤마 등 비한글 → 그대로
      return revealedIndices.has(i) ? c : getChosung(c);
    })
    .join('');
}


// 문제 뱅크 (DB에서 로드)
export let quizBank: Quiz[] = [];

export async function loadQuizBank(): Promise<void> {
  // quizzes 테이블이 없으면 생성
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id               INTEGER PRIMARY KEY,
      answer           VARCHAR NOT NULL,
      chosung          VARCHAR NOT NULL,
      category         VARCHAR NOT NULL,
      alternate_answers TEXT NOT NULL DEFAULT '[]'
    )
  `);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS attempt_count BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_count  BIGINT NOT NULL DEFAULT 0`);

  // seed보다 DB가 적으면 누락 항목을 upsert (새 카테고리 추가 시 자동 반영)
  const seedPath = join(__dirname, 'quizzes_seed.json');
  const seedData: [number, string, string, string, string[]][] = JSON.parse(readFileSync(seedPath, 'utf-8'));

  const { rows: countRows } = await pool.query<{ c: string }>('SELECT COUNT(*) AS c FROM quizzes');
  const dbCount = parseInt(countRows[0].c, 10);

  if (seedData.length > dbCount) {
    console.log(`[QuizBank] seed ${seedData.length}개 > DB ${dbCount}개 — 누락 항목 동기화 중`);
    const BATCH = 500;
    for (let i = 0; i < seedData.length; i += BATCH) {
      const chunk = seedData.slice(i, i + BATCH);
      const values = chunk
        .map((_, j) => {
          const base = j * 5 + 1;
          return `($${base},$${base+1},$${base+2},$${base+3},$${base+4})`;
        })
        .join(',');
      const params = chunk.flatMap(([id, answer, chosung, category, alt]) => [
        id, answer, chosung, category, JSON.stringify(alt),
      ]);
      await pool.query(
        `INSERT INTO quizzes (id, answer, chosung, category, alternate_answers) VALUES ${values}
         ON CONFLICT (id) DO NOTHING`,
        params
      );
    }
    const { rows: afterRows } = await pool.query<{ c: string }>('SELECT COUNT(*) AS c FROM quizzes');
    console.log(`[QuizBank] 동기화 완료: ${afterRows[0].c}개`);
  } else {
    console.log(`[QuizBank] DB에 ${dbCount}개 존재 — seed 동기화 불필요`);
  }

  await reloadQuizBankFromDb();
}

// DB에서 quizBank를 다시 읽어 메모리에 반영 (재시작 없이 즉시 적용)
export async function reloadQuizBankFromDb(): Promise<number> {
  const { rows } = await pool.query<{
    id: number; answer: string; chosung: string; category: string;
    alternate_answers: string; attempt_count: string; correct_count: string;
  }>(
    'SELECT id, answer, chosung, category, alternate_answers, attempt_count, correct_count FROM quizzes ORDER BY id'
  );
  quizBank = rows.map((r) => ({
    id: r.id,
    answer: r.answer,
    chosung: r.chosung,
    category: r.category,
    alternateAnswers: JSON.parse(r.alternate_answers || '[]'),
    attemptCount: parseInt(r.attempt_count, 10) || 0,
    correctCount: parseInt(r.correct_count, 10) || 0,
  }));
  console.log(`[QuizBank] Loaded ${quizBank.length} quizzes from DB`);
  return quizBank.length;
}

// 퀴즈 출제 시 attempt_count 증가 (fire-and-forget)
export function incrementQuizAttempt(quizId: number): void {
  const q = quizBank.find((q) => q.id === quizId);
  if (q) q.attemptCount += 1;
  pool.query('UPDATE quizzes SET attempt_count = attempt_count + 1 WHERE id = $1', [quizId]).catch(() => {});
}

// 정답 처리 시 correct_count 증가 (fire-and-forget)
export function incrementQuizCorrect(quizId: number): void {
  const q = quizBank.find((q) => q.id === quizId);
  if (q) q.correctCount += 1;
  pool.query('UPDATE quizzes SET correct_count = correct_count + 1 WHERE id = $1', [quizId]).catch(() => {});
}


// 세션 저장소 (roomId → 세션)
const sessions = new Map<string, GameSession>();

// 타이머 저장소 (roomId → timeout ID)
const sessionTimers = new Map<string, NodeJS.Timeout>();

// 3분 비활동 시 자동 종료
export const TIMEOUT_MS = 3 * 60 * 1000;

export function getSession(roomId: string): GameSession | undefined {
  return sessions.get(roomId);
}

export function getAllSessions(): { roomId: string; mode: string; category?: string; score: number; correct: number; total: number; startedAt: Date }[] {
  return [...sessions.entries()]
    .filter(([, s]) => !s.ended)
    .map(([roomId, s]) => ({
      roomId,
      mode: s.mode,
      category: s.quizCategory,
      score: s.score,
      correct: s.correct,
      total: s.total,
      startedAt: s.startedAt,
    }));
}


// 타이머 리셋 (활동이 있을 때마다 호출)
export function resetSessionTimer(roomId: string): void {
  const existing = sessionTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    sessions.delete(roomId);
    sessionTimers.delete(roomId);
  }, TIMEOUT_MS);
  sessionTimers.set(roomId, timer);
}

export function createSession(
  roomId: string,
  userId: string,
  mode: 'chosung' | 'hunmin',
  category?: string,
): GameSession {
  const pool = category
    ? quizBank.filter((q) => q.category === category)
    : quizBank;
  const bank = pool.length > 0 ? pool : quizBank;
  const randomQuiz = bank[Math.floor(Math.random() * bank.length)];
  const now = new Date();
  const session: GameSession = {
    roomId,
    userId,
    mode,
    currentQuizId: randomQuiz.id,
    score: 0,
    correct: 0,
    total: 0,
    startedAt: now,
    lastActivityAt: now,
    currentWrong: 0,
    questionStartedAt: now,
    hintsUsed: 0,
    currentPts: category ? 3750 : 7500, // 주제선택=3750파편, 랜덤=7500파편 — v2.9
    revealedKoreanIndices: [],
    quizCategory: category,
  };
  sessions.set(roomId, session);
  resetSessionTimer(roomId);
  return session;
}

export function endSession(roomId: string): void {
  const timer = sessionTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    sessionTimers.delete(roomId);
  }
  sessions.delete(roomId);
}

// 게임 종료 후 세션 유지 (다음문제 버튼을 위해) — 10분 후 자동 정리
export function suspendSession(roomId: string): void {
  const timer = sessionTimers.get(roomId);
  if (timer) clearTimeout(timer);
  const session = sessions.get(roomId);
  if (!session) return;
  session.ended = true;
  const cleanup = setTimeout(() => {
    sessions.delete(roomId);
    sessionTimers.delete(roomId);
  }, 10 * 60 * 1000);
  sessionTimers.set(roomId, cleanup);
}

// ── PostgreSQL 영속화 ────────────────────────────

// KST(UTC+9) 기준 오늘 날짜 문자열 반환
export function getTodayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 랭킹 캐시 (userId → UserScore) — DB와 항상 동기화됨
const rankingBoard: Map<string, UserScore> = new Map();
// 방 내 랭킹 저장소 (roomId → Map<userId, UserScore>) — 인메모리 전용
const roomBoards: Map<string, Map<string, UserScore>> = new Map();
// 출석체크 캐시 (userId → 마지막 출석일 KST)
const attendanceLog: Map<string, string> = new Map();

// DB에서 모든 유저 데이터를 읽어 캐시 초기화 (서버 시작 시 1회 호출)
export async function initFromDb(): Promise<void> {
  try {
    // room_users 테이블 자동 생성 (없을 경우 대비 - 프로덕션 첫 배포 호환)
    await pool.query(`CREATE TABLE IF NOT EXISTS room_users (
      room_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      nickname VARCHAR(255) NOT NULL DEFAULT '',
      score BIGINT NOT NULL DEFAULT 0,
      correct BIGINT NOT NULL DEFAULT 0,
      total BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (room_id, user_id)
    )`);
    // 구버전 호환: 컬럼 없으면 추가
    await pool.query(`ALTER TABLE room_users ADD COLUMN IF NOT EXISTS nickname VARCHAR(255) NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE room_users ADD COLUMN IF NOT EXISTS score BIGINT NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE room_users ADD COLUMN IF NOT EXISTS correct BIGINT NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE room_users ADD COLUMN IF NOT EXISTS total BIGINT NOT NULL DEFAULT 0`);
    // users 테이블 훈민정음 통계 컬럼 추가 (구버전 호환)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hunmin_wins  INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hunmin_max   INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hunmin_total INTEGER NOT NULL DEFAULT 0`);
    // 신규 유물 컬럼 추가 (구버전 호환)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS relic_inv_limit       INTEGER NOT NULL DEFAULT 6`);
    // v3.6: 기존 배포 환경에서 컬럼 DEFAULT 값 8→6으로 변경 (ADD COLUMN IF NOT EXISTS는 컬럼이 이미 존재하면 DEFAULT를 바꾸지 않으므로 별도 실행)
    await pool.query(`ALTER TABLE users ALTER COLUMN relic_inv_limit SET DEFAULT 6`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_streak           INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_jamo_date        VARCHAR(10) NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_best_streak      INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_total_count      INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_easy_count       INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_normal_count     INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS jamo_hard_count       INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_jamo_at          VARCHAR(30) DEFAULT ''`);
    // 카카오 일일 활동 유저 테이블 (명령어 1회 이상 입력한 유저)
    await pool.query(`CREATE TABLE IF NOT EXISTS kakao_daily_active (
      user_id       VARCHAR(255) NOT NULL,
      activity_date DATE         NOT NULL,
      PRIMARY KEY (user_id, activity_date)
    )`);
    // 이벤트: 방 초대 로그 (유저별 일일 최대 5개 방, 중복 방 불가)
    await pool.query(`CREATE TABLE IF NOT EXISTS event_invite_log (
      user_id       VARCHAR(255) NOT NULL,
      room_id       VARCHAR(255) NOT NULL,
      activity_date DATE         NOT NULL,
      PRIMARY KEY (user_id, room_id, activity_date)
    )`);
    // 이벤트: 에너지흡수 클레임 기록 (일 1회)
    await pool.query(`CREATE TABLE IF NOT EXISTS event_claim_log (
      user_id       VARCHAR(255) NOT NULL,
      activity_date DATE         NOT NULL,
      claimed_count INTEGER      NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, activity_date)
    )`);
    // 이벤트: 방별 선착순 1인 보상 수령 기록
    await pool.query(`CREATE TABLE IF NOT EXISTS event_room_claimed (
      room_id       VARCHAR(255) NOT NULL,
      activity_date DATE         NOT NULL,
      user_id       VARCHAR(255) NOT NULL,
      claimed_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      PRIMARY KEY (room_id, activity_date)
    )`);
    // 이벤트: 방 최초 방문 시각 (이벤트참여 유효성 검사용)
    await pool.query(`CREATE TABLE IF NOT EXISTS room_first_seen (
      room_id       VARCHAR(255) NOT NULL PRIMARY KEY,
      first_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
    // 출석 이력 테이블 (달력 기능용)
    await pool.query(`CREATE TABLE IF NOT EXISTS attendance_history (
      user_id VARCHAR(255) NOT NULL,
      date    VARCHAR(10)  NOT NULL,
      PRIMARY KEY (user_id, date)
    )`);
    // 기존 last_attendance 데이터를 attendance_history에 백필
    await pool.query(`INSERT INTO attendance_history (user_id, date)
      SELECT user_id, last_attendance FROM users
      WHERE last_attendance != '' ON CONFLICT DO NOTHING`);
    // 서브게임 제거로 폐기된 컬럼 삭제 (프로덕션 포함 모든 환경 정리)
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS fate_ticket_count`);
    await pool.query(`ALTER TABLE users DROP COLUMN IF EXISTS prophecy_ticket_count`);
    // 신규 가입 웰컴 보너스 마이그레이션: score=0인 기존 유저를 50P로 올림
    await pool.query(`UPDATE users SET score = 50 WHERE score = 0`);

    // dict_words 테이블 자동 생성 + 시딩 (프로덕션 첫 배포 호환)
    await pool.query(`CREATE TABLE IF NOT EXISTS dict_words (
      word     VARCHAR(20) PRIMARY KEY,
      chosung  VARCHAR(20) NOT NULL,
      word_len SMALLINT    NOT NULL
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dict_chosung ON dict_words (chosung)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_dict_len ON dict_words (word_len)`);
    const { rows: countRows } = await pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM dict_words`);
    const seedPath = join(__dirname, 'dict_words_seed.json');
    const seedData: [string, string, number][] = JSON.parse(readFileSync(seedPath, 'utf-8'));
    const dbCount = parseInt(countRows[0].c);
    if (dbCount < seedData.length) {
      console.log(`[initFromDb] dict_words 동기화 필요 (DB: ${dbCount} < seed: ${seedData.length}) → 업서트 시작...`);
      const BATCH = 1000;
      for (let i = 0; i < seedData.length; i += BATCH) {
        const chunk = seedData.slice(i, i + BATCH);
        const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(',');
        const params = chunk.flatMap(([w, c, l]) => [w, c, l]);
        await pool.query(
          `INSERT INTO dict_words (word, chosung, word_len) VALUES ${values} ON CONFLICT DO NOTHING`,
          params,
        );
      }
      console.log(`[initFromDb] dict_words 동기화 완료: ${seedData.length}개`);
    } else {
      console.log(`[initFromDb] dict_words 최신 상태 (${dbCount}개)`);
    }

    // 부적절 단어 자동 정리 (서버 시작마다 실행 — 개발/프로덕션 모두 적용)
    const BANNED_WORDS = [
      "섹스","섹스가","섹스는","섹스도","섹스랑","섹스로","섹스를","섹스에","섹스요","섹스의","섹스하고","섹스한","섹스할","카섹스",
      "섹시하게","섹시하고","섹시하군","섹시하다","섹시한","섹시해",
      "강간","강간은","강간하고","강간한",
      "성교","성교를","성교하다",
      "성폭력",
      "발기","발기되다","발기부전","발기하다",
      "보지는","보지를","보지지","보지직","백보지","밴대보지","해보지",
      "자위","자위하다","자위행위",
      "자지도","자지레","자지를","자지리",
      "정액","정액을",
      "음경","음부","음핵","음란","음란하다",
      "항문","항문관","항문에","항문외과","항문을",
      "에이즈","콘돔",
      "고추자지",
      "갈보","똥갈보","양갈보",
      "개새끼",
      "개지랄","돈지랄","좆지랄","지랄","지랄을","지랄이","지랄이야","지랄이여","지랄하다",
      "나체","나체화","반나체",
      "매음부","매춘","매춘부","매춘하다",
      "반병신","병신","병신들아","병신아","병신은","병신이",
      "변태","변태성욕","변태심리","변태야",
      "씨발","씨발놈",
      "씹거웃","씹구멍","씹두덩","씹새끼","씹창","씹탱이","씹하다","씹히다",
      "좆같은","좆대가리","좆새끼",
      "창녀","창녀야","창녀와",
      "미친","미친개","미친갯병","미친거","미친것","미친게",
      "귀머거리","벙어리","벙어리가","앉은뱅이",
      "저능","저능아","천치",
      "애자지정",
      "동성애","동성애자","레즈비언","범성애","범성애자","양성애","양성애자",
      "장애자",
      "자살","자살극","자살로","자살은","자살을","자살이","자살자",
      "자살하게","자살하고","자살하다","자살한","자살할","투신자살",
      "자해","자해하다",
      "대마초","마리화나","코카인","헤로인","필로폰","히로뽕","마약상","마약범",
      "낙태","낙태죄","낙태하다",
      "미친년","미친놈",
      "새끼","사내새끼","애새끼","자식새끼","쥐새끼",
      "놈팡이",
      "살인마","살인강도",
      "성관계","성기","성기가","성기를","성기에",
    ];
    const { rowCount: bannedDeleted } = await pool.query(
      `DELETE FROM dict_words WHERE word = ANY($1::text[])`,
      [BANNED_WORDS],
    );
    if ((bannedDeleted ?? 0) > 0) {
      console.log(`[initFromDb] 부적절 단어 ${bannedDeleted}개 자동 삭제 완료`);
    }

    const rows = await db.select().from(usersTable);
    for (const row of rows) {
      rankingBoard.set(row.userId, {
        userId:               row.userId,
        nickname:             getFixedNickname(row.userId) ?? row.nickname,
        score:                row.score,
        correct:              row.correct,
        total:                row.total,
        hunminWins:           row.hunminWins           ?? 0,
        hunminMax:            row.hunminMax            ?? 0,
        hunminTotal:          row.hunminTotal          ?? 0,
        relicInvLimit:        row.relicInvLimit        ?? 6,
        jamoStreak:           row.jamoStreak           ?? 0,
        lastJamoDate:         row.lastJamoDate         ?? '',
        jamoBestStreak:       row.jamoBestStreak       ?? 0,
        jamoTotalCount:       row.jamoTotalCount       ?? 0,
        jamoEasyCount:        row.jamoEasyCount        ?? 0,
        jamoNormalCount:      row.jamoNormalCount      ?? 0,
        jamoHardCount:        row.jamoHardCount        ?? 0,
        lastJamoAt:           row.lastJamoAt           ?? '',
      });
      if (row.lastAttendance) attendanceLog.set(row.userId, row.lastAttendance);
    }
    // 닉네임 복원: 닉변 이력이 있는데 현재 DB 닉네임이 달라진 경우 자동 복원
    const { rows: restoredNicks } = await pool.query<{ user_id: string; new_nickname: string }>(
      `UPDATE users u
       SET nickname = n.new_nickname
       FROM (
         SELECT DISTINCT ON (user_id) user_id, new_nickname
         FROM nickname_change_log
         ORDER BY user_id, changed_at DESC
       ) n
       WHERE u.user_id = n.user_id
         AND u.nickname <> n.new_nickname
       RETURNING u.user_id, n.new_nickname`,
    );
    for (const r of restoredNicks) {
      const mem = rankingBoard.get(r.user_id);
      if (mem) {
        mem.nickname = r.new_nickname;
        rankingBoard.set(r.user_id, mem);
      }
      pool.query('UPDATE room_users SET nickname = $1 WHERE user_id = $2', [r.new_nickname, r.user_id]).catch(() => {});
    }
    if (restoredNicks.length > 0) {
      console.log(`[initFromDb] 닉네임 자동 복원: ${restoredNicks.length}명 (${restoredNicks.map(r => r.new_nickname).join(', ')})`);
    }
    // 방 참가자 복원 (roomBoards 재구축, 방별 점수 포함)
    const roomRows = await db.select().from(roomUsersTable);
    for (const row of roomRows) {
      if (!roomBoards.has(row.roomId)) roomBoards.set(row.roomId, new Map());
      const board = roomBoards.get(row.roomId)!;
      if (!board.has(row.userId)) {
        board.set(row.userId, {
          userId:              row.userId,
          nickname:            row.nickname,
          score:               row.score    ?? 0,
          correct:             row.correct  ?? 0,
          total:               row.total    ?? 0,
          hunminWins:          0,
          hunminMax:           0,
          hunminTotal:         0,
          relicInvLimit:       6,
          jamoStreak:          0,
          lastJamoDate:        '',
          jamoBestStreak:      0,
          jamoTotalCount:      0,
          jamoEasyCount:       0,
          jamoNormalCount:     0,
          jamoHardCount:       0,
          lastJamoAt:          '',
        });
      }
    }
    // battle_log 테이블 생성 (배틀 시스템)
    await pool.query(`CREATE TABLE IF NOT EXISTS battle_log (
      attacker_id VARCHAR(255),
      battle_date VARCHAR(10),
      count       INTEGER NOT NULL DEFAULT 0,
      won         INTEGER NOT NULL DEFAULT 0,
      lost        INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (attacker_id, battle_date)
    )`);
    // battle_log: 기존 테이블에 won/lost 컬럼 추가 (없을 경우만)
    await pool.query(`ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS won  INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE battle_log ADD COLUMN IF NOT EXISTS lost INTEGER NOT NULL DEFAULT 0`);
    // battle_result_log: 개별 배틀 결과 기록 (상대닉네임·날짜·승패·강탈량)
    await pool.query(`CREATE TABLE IF NOT EXISTS battle_result_log (
      id           SERIAL PRIMARY KEY,
      attacker_id  VARCHAR(255) NOT NULL,
      defender_id  VARCHAR(255) NOT NULL,
      defender_nick VARCHAR(100) NOT NULL DEFAULT '',
      battle_date  VARCHAR(10)  NOT NULL,
      battle_ts    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      won          BOOLEAN      NOT NULL,
      steal_net    INTEGER      NOT NULL DEFAULT 0
    )`);
    // gift_log 테이블 생성 (없을 경우)
    await pool.query(`CREATE TABLE IF NOT EXISTS gift_log (
      user_id   VARCHAR(255) PRIMARY KEY,
      gift_date VARCHAR(10)  NOT NULL DEFAULT '',
      sent      BIGINT       NOT NULL DEFAULT 0,
      count     INTEGER      NOT NULL DEFAULT 0
    )`);
    // 업적 영구 보존 테이블
    await pool.query(`CREATE TABLE IF NOT EXISTS earned_titles (
      user_id  VARCHAR(255) NOT NULL,
      title_id VARCHAR(64)  NOT NULL,
      earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, title_id)
    )`);
    // 닉네임 변경 이력
    await pool.query(`CREATE TABLE IF NOT EXISTS nickname_change_log (
      id          SERIAL       PRIMARY KEY,
      user_id     VARCHAR(255) NOT NULL,
      old_nickname VARCHAR(255) NOT NULL DEFAULT '',
      new_nickname VARCHAR(255) NOT NULL,
      changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_nick_change_log_user ON nickname_change_log (user_id, changed_at DESC)`);
    // gift_log 캐시 복원 (오늘 날짜만 유효)
    const today = getTodayKST();
    const giftRows = await db.select().from(giftLogTable);
    for (const row of giftRows) {
      if (row.giftDate === today) {
        giftLog.set(row.userId, { date: row.giftDate, sent: row.sent, count: row.count });
      }
    }
  } catch (err) {
    console.error('[initFromDb] DB 초기화 실패:', err);
  }
}

// 캐시 → DB upsert (fire-and-forget)
function persistUser(
  userId: string,
  nickname: string,
  score: number,
  correct: number,
  total: number,
  lastAttendance?: string,
  hunminWins?: number,
  hunminMax?: number,
  hunminTotal?: number,
  relicInvLimit?: number,
  jamoStreak?: number,
  lastJamoDate?: string,
  jamoBestStreak?: number,
  jamoTotalCount?: number,
  jamoEasyCount?: number,
  jamoNormalCount?: number,
  jamoHardCount?: number,
  lastJamoAt?: string,
): void {
  const att  = lastAttendance ?? attendanceLog.get(userId) ?? '';
  const mem  = rankingBoard.get(userId);
  const hw   = hunminWins    ?? mem?.hunminWins    ?? 0;
  const hm   = hunminMax     ?? mem?.hunminMax     ?? 0;
  const ht   = hunminTotal   ?? mem?.hunminTotal   ?? 0;
  const ril  = relicInvLimit ?? mem?.relicInvLimit ?? 6;
  const js   = jamoStreak    ?? mem?.jamoStreak    ?? 0;
  const ljd  = lastJamoDate  ?? mem?.lastJamoDate  ?? '';
  const jbs  = jamoBestStreak ?? mem?.jamoBestStreak ?? 0;
  const jtc  = jamoTotalCount  ?? mem?.jamoTotalCount  ?? 0;
  const jec  = jamoEasyCount   ?? mem?.jamoEasyCount   ?? 0;
  const jnc  = jamoNormalCount ?? mem?.jamoNormalCount ?? 0;
  const jhc  = jamoHardCount   ?? mem?.jamoHardCount   ?? 0;
  const lja  = lastJamoAt      ?? mem?.lastJamoAt      ?? '';
  db.insert(usersTable)
    .values({ userId, nickname, score, correct, total, lastAttendance: att,
              hunminWins: hw, hunminMax: hm, hunminTotal: ht,
              relicInvLimit: ril, jamoStreak: js, lastJamoDate: ljd, jamoBestStreak: jbs,
              jamoTotalCount: jtc, jamoEasyCount: jec, jamoNormalCount: jnc, jamoHardCount: jhc, lastJamoAt: lja })
    .onConflictDoUpdate({
      target: usersTable.userId,
      set: {
        // 빈 닉네임으로 기존 닉네임을 덮어쓰지 않도록 방어 (재배포 레이스컨디션 대비)
        nickname: sql`CASE WHEN EXCLUDED.nickname <> '' THEN EXCLUDED.nickname ELSE ${usersTable.nickname} END`,
        score, correct, total, lastAttendance: att,
        hunminWins: hw, hunminMax: hm, hunminTotal: ht,
        relicInvLimit: ril, jamoStreak: js, lastJamoDate: ljd, jamoBestStreak: jbs,
        jamoTotalCount: jtc, jamoEasyCount: jec, jamoNormalCount: jnc, jamoHardCount: jhc, lastJamoAt: lja,
      },
    })
    .catch((err: unknown) => {
      console.error('[persistUser] DB 저장 실패:', err);
    });
}

export function getCurrentQuiz(session: GameSession): Quiz | undefined {
  return quizBank.find((q) => q.id === session.currentQuizId);
}

export function nextQuiz(session: GameSession): Quiz {
  // 주제선택 모드면 같은 카테고리에서, 랜덤 모드면 전체에서 다음 문제 선택
  const pool = session.quizCategory
    ? quizBank.filter((q) => q.category === session.quizCategory && q.id !== session.currentQuizId)
    : quizBank.filter((q) => q.id !== session.currentQuizId);
  const bank = pool.length > 0 ? pool : quizBank.filter((q) => q.id !== session.currentQuizId);
  const next = bank[Math.floor(Math.random() * bank.length)];
  session.currentQuizId = next.id;
  session.currentWrong = 0;
  session.hintsUsed = 0;
  session.revealedKoreanIndices = [];
  session.currentPts = session.quizCategory ? 3750 : 7500;
  session.questionStartedAt = new Date();
  session.lastCreditedQuizId = undefined;
  return next;
}

// 유저 파편 차감. 파편 부족이면 false 반환, 성공하면 true
export function deductFragments(userId: string, nickname: string, amount: number): boolean {
  const existing = rankingBoard.get(userId);
  if (!existing || existing.score < amount) return false;
  existing.score -= amount;
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total);
  return true;
}

// 포인트 반환 (보상 경로 전용 — total/correct 카운트 변경 없음)
export function refundPoints(userId: string, nickname: string, amount: number): void {
  const existing = rankingBoard.get(userId);
  if (!existing) return;
  existing.score += amount;
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total);
}

// ── 파편 선물 시스템 ────────────────────────────────
export const GIFT_DAILY_MAX   = 30000; // 하루 선물 가능 총 파편 한도
export const GIFT_DAILY_LIMIT = 5;    // 하루 최대 선물 횟수
interface GiftEntry { date: string; sent: number; count: number; }
const giftLog = new Map<string, GiftEntry>(); // senderId → {date, sent, count}

export function getGiftSentToday(senderId: string): number {
  const entry = giftLog.get(senderId);
  if (!entry || entry.date !== getTodayKST()) return 0;
  return entry.sent;
}

export function getGiftCountToday(senderId: string): number {
  const entry = giftLog.get(senderId);
  if (!entry || entry.date !== getTodayKST()) return 0;
  return entry.count;
}

export function getRemainingGiftFragments(senderId: string): number {
  return Math.max(0, GIFT_DAILY_MAX - getGiftSentToday(senderId));
}

export function getRemainingGiftCount(senderId: string): number {
  return Math.max(0, GIFT_DAILY_LIMIT - getGiftCountToday(senderId));
}

export function sendGiftFragments(
  senderId: string, senderNick: string,
  receiverId: string, amount: number
): 'self' | 'over_limit_count' | 'over_limit_frags' | 'no_target' | 'no_funds' | 'success' {
  if (senderId === receiverId) return 'self';
  if (getGiftCountToday(senderId) >= GIFT_DAILY_LIMIT) return 'over_limit_count';
  if (amount > getRemainingGiftFragments(senderId)) return 'over_limit_frags';
  const recv = rankingBoard.get(receiverId);
  if (!recv) return 'no_target';
  if (!deductFragments(senderId, senderNick, amount)) return 'no_funds';
  recv.score += amount;
  rankingBoard.set(receiverId, recv);
  persistUser(receiverId, recv.nickname, recv.score, recv.correct, recv.total);
  const today = getTodayKST();
  const prev = giftLog.get(senderId);
  const isSameDay = prev?.date === today;
  const newEntry = {
    date:  today,
    sent:  isSameDay ? prev!.sent  + amount : amount,
    count: isSameDay ? prev!.count + 1      : 1,
  };
  giftLog.set(senderId, newEntry);
  // DB 영속화 (fire-and-forget)
  db.insert(giftLogTable)
    .values({ userId: senderId, giftDate: today, sent: newEntry.sent, count: newEntry.count })
    .onConflictDoUpdate({
      target: giftLogTable.userId,
      set: { giftDate: today, sent: newEntry.sent, count: newEntry.count },
    })
    .catch((err: unknown) => {
      console.error('[sendGiftFragments] DB 저장 실패:', err);
    });
  return 'success';
}

// ── 콤보 시스템 (DB 영속화) ─────────────────────────────
// 서버 재시작 시 콤보 진행 상태가 초기화되지 않도록 DB에 저장
interface WinRecord { gameType: 'chosung' | 'hunmin' | 'jamo'; ts: number; }
const userWinHistory  = new Map<string, WinRecord[]>();
const userComboExpiry = new Map<string, number>();     // userId → 만료 ms

const COMBO_WINS_REQUIRED = 5;               // 콤보 발동 필요 승리 수
const COMBO_WINDOW_MS     = 10 * 60 * 1000; // 콤보 판정 윈도우: 10분
const COMBO_DURATION_MS   = 60 * 1000;      // 콤보 지속 시간: 60초

/** 서버 시작 시 DB에서 유효한 콤보 상태 복원 */
export async function initComboState(): Promise<void> {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS user_combo_state (
      user_id        VARCHAR(255) PRIMARY KEY,
      win_timestamps BIGINT[]    NOT NULL DEFAULT '{}',
      combo_expiry   BIGINT      NOT NULL DEFAULT 0
    )`);
    const now = Date.now();
    const cutoff = now - COMBO_WINDOW_MS;
    const { rows } = await pool.query<{ user_id: string; win_timestamps: string; combo_expiry: string }>(
      `SELECT user_id, win_timestamps, combo_expiry FROM user_combo_state
       WHERE combo_expiry > $1 OR array_length(win_timestamps, 1) > 0`,
      [now]
    );
    for (const row of rows) {
      // pool.query는 snake_case 키 반환 → row.user_id
      const expiry = Number(row.combo_expiry);
      if (expiry > now) {
        userComboExpiry.set(row.user_id, expiry);
      }
      // win_timestamps는 PostgreSQL 배열로 반환됨
      const rawTs = row.win_timestamps as unknown as string[];
      if (Array.isArray(rawTs) && rawTs.length > 0) {
        const history: WinRecord[] = rawTs
          .map(t => ({ gameType: 'chosung' as const, ts: Number(t) }))
          .filter(r => r.ts > cutoff);
        if (history.length > 0) userWinHistory.set(row.user_id, history);
      }
    }
  } catch (err) {
    console.error('[initComboState] 콤보 상태 복원 실패:', err);
  }
}

/** 콤보 상태를 DB에 비동기 저장 (fire-and-forget) */
function persistComboState(userId: string): void {
  const history   = userWinHistory.get(userId) ?? [];
  const expiry    = userComboExpiry.get(userId) ?? 0;
  const tsArray   = history.map(r => r.ts);
  pool.query(
    `INSERT INTO user_combo_state (user_id, win_timestamps, combo_expiry)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       win_timestamps = EXCLUDED.win_timestamps,
       combo_expiry   = EXCLUDED.combo_expiry`,
    [userId, tsArray, expiry]
  ).catch(() => {});
}

/** 콤보 활성 여부 (유저별 독립) */
export function isComboActive(userId: string): boolean {
  const expiry = userComboExpiry.get(userId);
  if (!expiry) return false;
  if (Date.now() > expiry) { userComboExpiry.delete(userId); return false; }
  return true;
}

/** 콤보 남은 시간 (초) */
export function getComboRemainingSeconds(userId: string): number {
  const expiry = userComboExpiry.get(userId);
  if (!expiry) return 0;
  return Math.max(0, Math.round((expiry - Date.now()) / 1000));
}

/** 현재 콤보 진행 카운트 (발동 전) */
export function getComboWinCount(userId: string): number {
  if (isComboActive(userId)) return 0;
  const now = Date.now();
  const cutoff = now - COMBO_WINDOW_MS;
  const history = userWinHistory.get(userId) ?? [];
  return history.filter(r => r.ts > cutoff).length;
}

/** 승리 기록 후 새 콤보 발동 여부 반환.
 *  - 콤보 활성 중엔 카운트 중단 (재발동 불가)
 *  - 10분 내 5회 달성 시 true 반환 + 60초 콤보 시작 + 카운터 초기화
 */
export function recordWin(userId: string, gameType: 'chosung' | 'hunmin' | 'jamo'): boolean {
  // 콤보 활성 중 → 카운트 안 함
  if (isComboActive(userId)) return false;

  const now = Date.now();
  const history = userWinHistory.get(userId) ?? [];
  history.push({ gameType, ts: now });
  // 10분 윈도우 밖 기록 제거
  const cutoff = now - COMBO_WINDOW_MS;
  while (history.length > 0 && history[0].ts < cutoff) history.shift();
  userWinHistory.set(userId, history);

  if (history.length >= COMBO_WINS_REQUIRED) {
    userWinHistory.delete(userId);
    userComboExpiry.set(userId, now + COMBO_DURATION_MS);
    persistComboState(userId);
    return true;
  }
  persistComboState(userId);
  return false;
}

/** 콤보 활성 시 20% 보너스 적용 */
export function applyComboBonus(amount: number, userId: string): number {
  if (isComboActive(userId)) return Math.round(amount * 1.2);
  return amount;
}

// 공백 제거 + 소문자화
function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}
// 한글 음절만 추출 (숫자·특수문자·영문 생략 허용)
function koreanOnly(s: string): string {
  return s.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '');
}

export function checkAnswer(quiz: Quiz, userAnswer: string): boolean {
  const normUser = normalizeAnswer(userAnswer);
  const allAnswers = [quiz.answer, ...(quiz.alternateAnswers ?? [])].map(normalizeAnswer);

  // 1. 공백 제거 후 직접 비교
  if (allAnswers.includes(normUser)) return true;

  // 2. 숫자·특수문자 생략 허용 — 한글만 추출해서 비교
  const koUser = koreanOnly(normUser);
  if (koUser.length > 0 && allAnswers.some((a) => koreanOnly(a) === koUser)) return true;

  return false;
}

function defaultUserScore(userId: string, nickname: string): UserScore {
  return { userId, nickname, score: 50, correct: 0, total: 0, hunminWins: 0, hunminMax: 0, hunminTotal: 0,
           relicInvLimit: 8, jamoStreak: 0, lastJamoDate: '', jamoBestStreak: 0,
           jamoTotalCount: 0, jamoEasyCount: 0, jamoNormalCount: 0, jamoHardCount: 0, lastJamoAt: '' };
}

export function recordScore(
  userId: string,
  nickname: string,
  pointsGained: number,
  source: 'earn_chosung' | 'earn_jamo' | 'earn_sell' | 'earn' = 'earn',
): void {
  const existing = rankingBoard.get(userId) ?? defaultUserScore(userId, nickname);
  existing.total   += 1;
  existing.correct += 1;
  existing.score   += pointsGained;
  // 기존 닉네임 유지 (닉네임변경 결과 보존) — 신규 유저만 nickname 파라미터 사용
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total, undefined, existing.hunminWins, existing.hunminMax, existing.hunminTotal);
  // 모니터링: 포인트 유입 이벤트 (게임 유형별 구분)
  logEvent(source, userId, pointsGained);
}

// 오답 시 호출 — total만 +1 (correct는 건드리지 않음)
export function recordWrong(userId: string, nickname: string): void {
  const existing = rankingBoard.get(userId) ?? defaultUserScore(userId, nickname);
  existing.total   += 1;
  // 기존 닉네임 유지 (닉네임변경 결과 보존)
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total, undefined, existing.hunminWins, existing.hunminMax, existing.hunminTotal);
}

// 관리자 전용: 인메모리 + DB 동시 score 조정 (correct/total 건드리지 않음)
export function adminAddScore(userId: string, amount: number): UserScore | null {
  const existing = rankingBoard.get(userId);
  if (!existing) return null;
  existing.score = Math.max(0, existing.score + amount);
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total);
  return { ...existing };
}

export function getRanking(): UserScore[] {
  return Array.from(rankingBoard.values())
    .sort((a, b) => b.score - a.score);
}

/** 관리자 강제 닉네임 변경 — 닉네임 필터 우회, 고정 닉네임(운영진/부운영진)은 차단.
 *  현재닉으로 유저를 찾아 인메모리 + DB 모두 업데이트. */
export function adminChangeNickname(
  fromNickname: string,
  toNickname: string,
): { ok: boolean; userId?: string; errorMsg?: string } {
  // 고정 닉네임 대상이면 차단
  const fixedNicks = [ADMIN_NICKNAME, ...SUB_ADMIN_NICKNAMES.values()];
  if (fixedNicks.includes(fromNickname) || fixedNicks.includes(toNickname)) {
    return { ok: false, errorMsg: "운영진/부운영진 닉네임은 변경할 수 없어요." };
  }
  // 현재 닉으로 유저 찾기
  const target = Array.from(rankingBoard.values()).find(u => u.nickname === fromNickname);
  if (!target) {
    return { ok: false, errorMsg: `"${fromNickname}" 닉네임을 가진 유저를 찾을 수 없어요.` };
  }
  // 새 닉네임 중복 체크
  const taken = Array.from(rankingBoard.values()).some(
    u => u.nickname === toNickname && u.userId !== target.userId,
  );
  if (taken) {
    return { ok: false, errorMsg: `"${toNickname}" 닉네임은 이미 다른 유저가 사용 중이에요.` };
  }
  target.nickname = toNickname;
  rankingBoard.set(target.userId, target);
  persistUser(target.userId, toNickname, target.score, target.correct, target.total,
    undefined, target.hunminWins, target.hunminMax, target.hunminTotal);
  pool.query(
    'UPDATE room_users SET nickname = $1 WHERE user_id = $2',
    [toNickname, target.userId],
  ).catch(() => {});
  pool.query(
    'INSERT INTO nickname_change_log (user_id, old_nickname, new_nickname) VALUES ($1, $2, $3)',
    [target.userId, `[관리자변경] ${fromNickname}`, toNickname],
  ).catch(() => {});
  return { ok: true, userId: target.userId };
}

/** 닉네임 변경 — 인메모리 + DB 반영. 성공 시 { ok: true }, 실패 시 { ok: false, errorMsg } */
// 카카오 명령어 1회 이상 입력한 유저 일별 기록 (fire-and-forget)
export function logDailyActive(userId: string): void {
  const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  pool.query(
    `INSERT INTO kakao_daily_active (user_id, activity_date) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, todayKST],
  ).catch(() => {});
}

export function changeNickname(
  userId: string,
  newNickname: string,
): { ok: boolean; errorMsg?: string } {
  // 금지어·형식 검사 (길이·공백·욕설·정치인·운영진 등)
  const filterResult = checkNickname(newNickname);
  if (!filterResult.ok) {
    return { ok: false, errorMsg: filterResult.reason };
  }
  // 중복 체크
  const taken = Array.from(rankingBoard.values()).some(
    u => u.nickname === newNickname && u.userId !== userId,
  );
  if (taken) {
    return { ok: false, errorMsg: `"${newNickname}" 닉네임은 이미 사용 중이에요.` };
  }
  const existing = rankingBoard.get(userId);
  if (!existing) {
    return { ok: false, errorMsg: "사용자 정보를 찾을 수 없어요. 먼저 봇과 대화해주세요." };
  }
  const oldNickname = existing.nickname;
  existing.nickname = newNickname;
  rankingBoard.set(userId, existing);
  persistUser(userId, newNickname, existing.score, existing.correct, existing.total,
    undefined, existing.hunminWins, existing.hunminMax, existing.hunminTotal);
  // room_users 테이블 전체 동기화 (참여 중인 모든 방)
  pool.query(
    'UPDATE room_users SET nickname = $1 WHERE user_id = $2',
    [newNickname, userId],
  ).catch(() => {});
  // 닉네임 변경 이력 기록
  pool.query(
    'INSERT INTO nickname_change_log (user_id, old_nickname, new_nickname) VALUES ($1, $2, $3)',
    [userId, oldNickname, newNickname],
  ).catch(() => {});
  return { ok: true };
}

/** 충돌 없는 자동 닉네임 생성 (슬라이딩 윈도우: [1:4], [2:5], ...) */
export function generateAutoNickname(userId: string): string {
  const suffix = userId.slice(-3);
  for (let offset = 1; offset + 3 <= userId.length; offset++) {
    const candidate = `능력자_${userId.slice(offset, offset + 3)}${suffix}`;
    const taken = Array.from(rankingBoard.values()).some(
      u => u.nickname === candidate && u.userId !== userId
    );
    if (!taken) return candidate;
  }
  return `능력자_${userId.slice(1, 4)}${suffix}`;
}

// 방 참가자 DB upsert (fire-and-forget)
function persistRoomUser(roomId: string, userId: string, nickname: string, score: number, correct: number, total: number): void {
  pool.query(
    `INSERT INTO room_users (room_id, user_id, nickname, score, correct, total)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (room_id, user_id) DO UPDATE
       SET nickname = EXCLUDED.nickname,
           score    = EXCLUDED.score,
           correct  = EXCLUDED.correct,
           total    = EXCLUDED.total`,
    [roomId, userId, nickname, score, correct, total]
  ).catch((err: unknown) => {
    console.error('[persistRoomUser] DB 저장 실패:', err);
  });
}

export function recordRoomScore(
  roomId: string,
  userId: string,
  nickname: string,
  pointsGained: number
): void {
  if (!roomBoards.has(roomId)) roomBoards.set(roomId, new Map());
  const board = roomBoards.get(roomId)!;
  // 글로벌 랭킹보드 닉네임 우선 사용 (닉네임변경 결과 보존)
  const effectiveNick = rankingBoard.get(userId)?.nickname ?? nickname;
  const existing = board.get(userId) ?? defaultUserScore(userId, effectiveNick);
  existing.total += 1;
  existing.correct += 1;
  existing.score += pointsGained;
  existing.nickname = effectiveNick;
  board.set(userId, existing);
  // 방 점수(방별 누적)를 DB에 영속화
  persistRoomUser(roomId, userId, effectiveNick, existing.score, existing.correct, existing.total);
}

export function getRoomRanking(roomId: string): UserScore[] {
  const board = roomBoards.get(roomId);
  if (!board) return [];
  // 방 참가자의 누적 파편(서버 전체 기준)으로 순위 산정
  // rankingBoard에 없으면 roomBoards 데이터로 폴백
  return Array.from(board.keys())
    .map((uid) => rankingBoard.get(uid) ?? board.get(uid))
    .filter((u): u is UserScore => u !== undefined)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

export function getUserScore(userId: string): UserScore | undefined {
  return rankingBoard.get(userId);
}

// room_users 테이블/메모리에 유저 등록 (없을 때만 insert)
async function ensureInRoomUsers(
  roomId: string, userId: string, nickname: string,
  score: number, correct: number, total: number,
): Promise<void> {
  if (!roomId) return;
  if (!roomBoards.has(roomId)) roomBoards.set(roomId, new Map());
  const board = roomBoards.get(roomId)!;
  if (!board.has(userId)) {
    board.set(userId, { userId, nickname, score: 0, correct: 0, total: 0, hunminWins: 0, hunminMax: 0, hunminTotal: 0, relicInvLimit: 8, jamoStreak: 0, lastJamoDate: '', jamoBestStreak: 0, jamoTotalCount: 0, jamoEasyCount: 0, jamoNormalCount: 0, jamoHardCount: 0, lastJamoAt: '' });
    db.insert(roomUsersTable)
      .values({ roomId, userId, nickname, score: 0, correct: 0, total: 0 })
      .onConflictDoNothing()
      .catch(() => {});
  }
}

// DB에 없으면 50P로 신규 생성, 있으면 로드 — room_users에도 등록
export async function ensureUserInRankingBoard(
  userId: string,
  nickname?: string,
  roomId?: string,
): Promise<UserScore> {
  const existing = rankingBoard.get(userId);
  if (existing) {
    // 운영진/부운영진은 항상 고정 닉네임으로 강제 동기화
    const fixed = getFixedNickname(userId);
    if (fixed && existing.nickname !== fixed) {
      existing.nickname = fixed;
      rankingBoard.set(userId, existing);
      pool.query("UPDATE users SET nickname = $1 WHERE user_id = $2", [fixed, userId]).catch(() => {});
      pool.query("UPDATE room_users SET nickname = $1 WHERE user_id = $2", [fixed, userId]).catch(() => {});
    }
    if (roomId) await ensureInRoomUsers(roomId, userId, existing.nickname, existing.score, existing.correct, existing.total);
    return existing;
  }
  // DB 조회
  try {
    const row = await pool.query<{
      user_id: string; nickname: string; score: string;
      correct: string; total: string;
      hunmin_wins: string; hunmin_max: string; hunmin_total: string;
    }>(
      "SELECT user_id, nickname, score, correct, total, hunmin_wins, hunmin_max, hunmin_total, relic_inv_limit, jamo_streak, last_jamo_date, jamo_best_streak, jamo_total_count, jamo_easy_count, jamo_normal_count, jamo_hard_count, last_jamo_at FROM users WHERE user_id = $1",
      [userId]
    );
    if (row.rows[0]) {
      const r = row.rows[0] as any;
      const fixed = getFixedNickname(userId);
      const resolvedNick = fixed ?? r.nickname;
      if (fixed && r.nickname !== fixed) {
        pool.query("UPDATE users SET nickname = $1 WHERE user_id = $2", [fixed, userId]).catch(() => {});
        pool.query("UPDATE room_users SET nickname = $1 WHERE user_id = $2", [fixed, userId]).catch(() => {});
      }
      const userScore: UserScore = {
        userId:              r.user_id,
        nickname:            resolvedNick,
        score:               Number(r.score),
        correct:             Number(r.correct),
        total:               Number(r.total),
        hunminWins:          Number(r.hunmin_wins           ?? 0),
        hunminMax:           Number(r.hunmin_max            ?? 0),
        hunminTotal:         Number(r.hunmin_total          ?? 0),
        relicInvLimit:       Number(r.relic_inv_limit       ?? 8),
        jamoStreak:          Number(r.jamo_streak           ?? 0),
        lastJamoDate:        String(r.last_jamo_date        ?? ''),
        jamoBestStreak:      Number(r.jamo_best_streak      ?? 0),
        jamoTotalCount:      Number(r.jamo_total_count      ?? 0),
        jamoEasyCount:       Number(r.jamo_easy_count       ?? 0),
        jamoNormalCount:     Number(r.jamo_normal_count     ?? 0),
        jamoHardCount:       Number(r.jamo_hard_count       ?? 0),
        lastJamoAt:          String(r.last_jamo_at          ?? ''),
      };
      rankingBoard.set(userId, userScore);
      if (roomId) await ensureInRoomUsers(roomId, userId, userScore.nickname, userScore.score, userScore.correct, userScore.total);
      return userScore;
    }
  } catch { /* 무시 */ }
  // DB에도 없음 → 신규 유저 500P로 생성
  const nick = getFixedNickname(userId) ?? nickname ?? generateAutoNickname(userId);
  const userScore: UserScore = {
    userId, nickname: nick, score: 500, correct: 0, total: 0,
    hunminWins: 0, hunminMax: 0, hunminTotal: 0,
    relicInvLimit: 8, jamoStreak: 0, lastJamoDate: '', jamoBestStreak: 0,
    jamoTotalCount: 0, jamoEasyCount: 0, jamoNormalCount: 0, jamoHardCount: 0, lastJamoAt: '',
  };
  rankingBoard.set(userId, userScore);
  persistUser(userId, nick, 500, 0, 0);
  if (roomId) await ensureInRoomUsers(roomId, userId, nick, 500, 0, 0);
  return userScore;
}

// ── 자모연성 스트릭 관리 ────────────────────────────────────────────────────
export function getJamoStreak(userId: string): number {
  return rankingBoard.get(userId)?.jamoStreak ?? 0;
}
export function getLastJamoDate(userId: string): string {
  return rankingBoard.get(userId)?.lastJamoDate ?? '';
}
export function updateJamoStreak(userId: string, _nickname: string, todayKST: string, difficulty?: 'easy' | 'normal' | 'hard'): number {
  const mem = rankingBoard.get(userId);
  if (!mem) return 0;
  const yesterday = (() => {
    const [y, mo, d] = todayKST.split('-').map(Number);
    const dt = new Date(y, mo - 1, d - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  })();
  const prev       = mem.lastJamoDate ?? '';
  const newStreak  = (prev === yesterday || prev === todayKST) ? (mem.jamoStreak ?? 0) + 1 : 1;
  const bestStreak = Math.max(newStreak, mem.jamoBestStreak ?? 0);
  const newTotal   = (mem.jamoTotalCount ?? 0) + 1;
  const newEasy    = (mem.jamoEasyCount   ?? 0) + (difficulty === 'easy'   ? 1 : 0);
  const newNormal  = (mem.jamoNormalCount ?? 0) + (difficulty === 'normal' ? 1 : 0);
  const newHard    = (mem.jamoHardCount   ?? 0) + (difficulty === 'hard'   ? 1 : 0);
  const nowIso     = new Date().toISOString();
  mem.jamoStreak     = newStreak;
  mem.lastJamoDate   = todayKST;
  mem.jamoBestStreak = bestStreak;
  mem.jamoTotalCount = newTotal;
  mem.jamoEasyCount  = newEasy;
  mem.jamoNormalCount = newNormal;
  mem.jamoHardCount  = newHard;
  mem.lastJamoAt     = nowIso;
  rankingBoard.set(userId, mem);
  persistUser(userId, mem.nickname, mem.score, mem.correct, mem.total, undefined, undefined, undefined, undefined,
              mem.relicInvLimit, newStreak, todayKST, bestStreak,
              newTotal, newEasy, newNormal, newHard, nowIso);
  return newStreak;
}
export function isFirstJamoToday(userId: string, todayKST: string): boolean {
  return (rankingBoard.get(userId)?.lastJamoDate ?? '') !== todayKST;
}

export function updateRelicInvLimit(userId: string, newLimit: number): void {
  const mem = rankingBoard.get(userId);
  if (!mem) return;
  mem.relicInvLimit = newLimit;
  rankingBoard.set(userId, mem);
  persistUser(userId, mem.nickname, mem.score, mem.correct, mem.total, undefined, undefined, undefined, undefined,
              newLimit);
}

export function getUserRoomScore(roomId: string, userId: string): UserScore | undefined {
  return roomBoards.get(roomId)?.get(userId);
}

// 서버 전체에서 userId의 순위 반환 (1-based, 없으면 -1)
export function getServerRank(userId: string): number {
  const sorted = Array.from(rankingBoard.values())
    .sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex((u) => u.userId === userId);
  return idx >= 0 ? idx + 1 : -1;
}

// 방 내에서 userId의 순위 반환 (1-based, 없으면 -1) — 서버 전체 파편 기준
// rankingBoard에 없으면 roomBoards 데이터로 폴백
export function getRoomRank(roomId: string, userId: string): number {
  const board = roomBoards.get(roomId);
  if (!board) return -1;
  const sorted = Array.from(board.keys())
    .map((uid) => rankingBoard.get(uid) ?? board.get(uid))
    .filter((u): u is UserScore => u !== undefined)
    .sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex((u) => u.userId === userId);
  return idx >= 0 ? idx + 1 : -1;
}

// ── 훈민정음 멀티플레이어 세션 ─────────────────────────

export const REGISTRATION_CANCEL_MS = 25_000;  // 등록 대기 제한: 25초 (시작 안 누르면 취소)
export const PLAYING_MS        = 45_000;   // 게임 진행:  45초
export const HUNMIN_WORD_REWARD = 5000;    // 단어 1개당 파편 — v4.0 2배 상향
export const HUNMIN_MVP_BONUS   = 12000;   // MVP 추가 파편 — v2.9 고정

export interface HunminSession {
  roomId: string;
  phase: 'registration' | 'playing';
  participants: Map<string, string>;        // userId → nickname
  registrationStartedAt: Date;
  chosung: string;
  wordLen: number;
  playingStartedAt: Date | null;
  usedWords: Set<string>;                   // 이미 제출된 단어 (중복 방지)
  roundScores: Map<string, number>;         // userId → 이번 라운드 정답 수
  registrationTimer: ReturnType<typeof setTimeout> | null;  // 자동 시작 타이머
  playingTimer: ReturnType<typeof setTimeout> | null;       // 자동 종료 타이머
  callbackUrl: string | null;               // 카카오 콜백 URL (자동 시작/취소 알림용)
}

const hunminSessions = new Map<string, HunminSession>();

export function getAllHunminSessions(): { roomId: string; phase: string; participants: number; chosung: string; wordLen: number; startedAt: Date }[] {
  return [...hunminSessions.entries()].map(([roomId, h]) => ({
    roomId,
    phase: h.phase,
    participants: h.participants.size,
    chosung: h.chosung,
    wordLen: h.wordLen,
    startedAt: h.registrationStartedAt,
  }));
}

export async function createHunminSession(roomId: string): Promise<HunminSession> {
  const { chosung, wordLen } = await pickRandomChosung();
  const session: HunminSession = {
    roomId,
    phase: 'registration',
    participants: new Map(),
    registrationStartedAt: new Date(),
    chosung,
    wordLen,
    playingStartedAt: null,
    usedWords: new Set(),
    roundScores: new Map(),
    registrationTimer: null,
    playingTimer: null,
    callbackUrl: null,
  };
  hunminSessions.set(roomId, session);
  return session;
}

export function getHunminSession(roomId: string): HunminSession | undefined {
  return hunminSessions.get(roomId);
}

export function endHunminSession(roomId: string): void {
  const session = hunminSessions.get(roomId);
  if (session) {
    if (session.registrationTimer) clearTimeout(session.registrationTimer);
    if (session.playingTimer) clearTimeout(session.playingTimer);
  }
  hunminSessions.delete(roomId);
}

// ── 카카오 이벤트 발신 (서버 → 카카오 → 채팅방) ──────────────
const KAKAO_BOT_ID      = process.env.KAKAO_BOT_ID ?? '';
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? '';
const KAKAO_EVENT_NAME  = 'hunmin_start';

export async function sendKakaoEvent(
  roomId: string,
  eventData: Record<string, unknown>,
): Promise<void> {
  if (!KAKAO_BOT_ID || !KAKAO_REST_API_KEY) return;
  try {
    await fetch(`https://bot-api.kakao.com/v2/bots/${KAKAO_BOT_ID}/group`, {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat: [{ id: roomId, type: 'botGroupKey' }],
        event: { name: KAKAO_EVENT_NAME, data: eventData },
      }),
    });
  } catch (err) {
    console.error('[sendKakaoEvent] 발신 실패', err);
  }
}

export function registerHunminParticipant(
  session: HunminSession,
  userId: string,
  nickname: string,
): void {
  // 글로벌 랭킹보드 닉네임 우선 사용 (닉네임변경 결과 보존)
  const effectiveNick = rankingBoard.get(userId)?.nickname ?? nickname;
  session.participants.set(userId, effectiveNick);
  if (!session.roundScores.has(userId)) {
    session.roundScores.set(userId, 0);
  }
}

export function transitionToPlaying(session: HunminSession): void {
  session.phase = 'playing';
  session.playingStartedAt = new Date();
  if (session.playingTimer) clearTimeout(session.playingTimer);
  session.playingTimer = setTimeout(() => {
    endHunminSession(session.roomId);
  }, PLAYING_MS + 60_000);
}

export function isRegistrationCancelled(session: HunminSession): boolean {
  return Date.now() - session.registrationStartedAt.getTime() >= REGISTRATION_CANCEL_MS;
}

export function isPlayingOver(session: HunminSession): boolean {
  if (!session.playingStartedAt) return false;
  return Date.now() - session.playingStartedAt.getTime() >= PLAYING_MS;
}

export function getRemainingPlaySec(session: HunminSession): number {
  if (!session.playingStartedAt) return PLAYING_MS / 1000;
  return Math.max(
    0,
    Math.ceil((PLAYING_MS - (Date.now() - session.playingStartedAt.getTime())) / 1000),
  );
}

// 훈민정음 단어 길이 가중치: 2글자 85%, 3글자 10%, 4글자 5%
const WORD_LEN_WEIGHTS: { len: number; weight: number }[] = [
  { len: 2, weight: 85 },
  { len: 3, weight: 10 },
  { len: 4, weight: 5 },
];

function pickWeightedWordLen(): number {
  const total = WORD_LEN_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const { len, weight } of WORD_LEN_WEIGHTS) {
    rand -= weight;
    if (rand < 0) return len;
  }
  return WORD_LEN_WEIGHTS[0].len;
}

export async function pickRandomChosung(): Promise<{ chosung: string; wordLen: number }> {
  const targetLen = pickWeightedWordLen();
  const result = await pool.query<{ chosung: string; word_len: number }>(
    `SELECT chosung, word_len FROM dict_words WHERE word_len = $1 ORDER BY RANDOM() LIMIT 1`,
    [targetLen],
  );
  if (result.rows.length > 0) {
    return { chosung: result.rows[0].chosung, wordLen: result.rows[0].word_len };
  }
  // 해당 길이 단어가 없을 경우 전체에서 랜덤
  const fallback = await pool.query<{ chosung: string; word_len: number }>(
    `SELECT chosung, word_len FROM dict_words ORDER BY RANDOM() LIMIT 1`,
  );
  if (fallback.rows.length === 0) throw new Error('No patterns in DB');
  return { chosung: fallback.rows[0].chosung, wordLen: fallback.rows[0].word_len };
}

export async function validateHunminWord(word: string, chosung: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM dict_words WHERE word = $1 AND chosung = $2 LIMIT 1`,
    [word, chosung],
  );
  return result.rows.length > 0;
}

export async function getHunminCandidateWords(chosung: string, wordLen: number): Promise<string[]> {
  const result = await pool.query<{ word: string }>(
    `SELECT word FROM dict_words WHERE chosung = $1 AND word_len = $2 ORDER BY word`,
    [chosung, wordLen],
  );
  return result.rows.map((r) => r.word);
}

// MVP 계산: 이번 라운드 정답 수 최고인 참여자들 (공동 1위 처리)
export function calcMvps(
  roundScores: Map<string, number>,
  participantNicknames: Map<string, string>,
): { userId: string; nickname: string; count: number }[] {
  if (roundScores.size === 0) return [];
  const maxScore = Math.max(...roundScores.values());
  if (maxScore === 0) return [];
  const mvps: { userId: string; nickname: string; count: number }[] = [];
  for (const [uid, cnt] of roundScores.entries()) {
    if (cnt === maxScore) {
      mvps.push({ userId: uid, nickname: participantNicknames.get(uid) ?? uid, count: cnt });
    }
  }
  return mvps;
}

// 훈민정음 단어 보상 지급 (서버 + 방 랭킹)
export function rewardHunminWord(
  roomId: string,
  userId: string,
  nickname: string,
  pts: number,
): number {
  const existing = rankingBoard.get(userId) ?? defaultUserScore(userId, nickname);
  existing.score = existing.score + pts;
  // 훈민정음 단어는 초성퀴즈 정답률(correct/total)에 포함하지 않음
  // 기존 닉네임 유지 (닉네임변경 결과 보존)
  rankingBoard.set(userId, existing);
  // 방 랭킹도 업데이트
  if (!roomBoards.has(roomId)) roomBoards.set(roomId, new Map());
  roomBoards.get(roomId)!.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total);
  // 모니터링: 포인트 유입 이벤트 (단어 보상 + MVP 보너스 모두 이 함수를 통해 지급됨)
  logEvent('earn_hunmin', userId, pts);
  return existing.score;
}

// 훈민정음 게임 종료 시 통계 기록 (참가자 1명씩 호출)
export function recordHunminStats(
  userId: string,
  nickname: string,
  wordsInGame: number,  // 이번 게임에서 맞춘 단어 수
  isWinner: boolean,    // MVP(우승) 여부
): void {
  const existing = rankingBoard.get(userId) ?? defaultUserScore(userId, nickname);
  if (isWinner) existing.hunminWins += 1;
  if (wordsInGame > (existing.hunminMax ?? 0)) existing.hunminMax = wordsInGame;
  existing.hunminTotal = (existing.hunminTotal ?? 0) + wordsInGame;
  // 기존 닉네임 유지 (닉네임변경 결과 보존)
  rankingBoard.set(userId, existing);
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total, undefined, existing.hunminWins, existing.hunminMax, existing.hunminTotal);
}

// ── 출석체크 ────────────────────────────────────

export const ATTENDANCE_REWARD = 10000;

export function hasAttendedToday(userId: string): boolean {
  return attendanceLog.get(userId) === getTodayKST();
}

// 출석체크 처리: 이미 했으면 'already', 성공하면 'success' 반환
export function recordAttendance(userId: string, nickname: string): 'already' | 'success' {
  if (hasAttendedToday(userId)) return 'already';
  const today = getTodayKST();
  attendanceLog.set(userId, today);
  // 서버 파편 300파편 지급
  const existing = rankingBoard.get(userId) ?? defaultUserScore(userId, nickname);
  existing.score += ATTENDANCE_REWARD;
  // 기존 닉네임 유지 (닉네임변경 결과 보존)
  rankingBoard.set(userId, existing);
  // 개인 파일에 저장 (출석일 포함)
  persistUser(userId, existing.nickname, existing.score, existing.correct, existing.total, today);
  // 출석 이력 누적 (달력 기능)
  pool.query(
    `INSERT INTO attendance_history (user_id, date) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, today]
  ).catch(() => {});
  // 모니터링: 출석체크 포인트 유입 이벤트
  logEvent('earn_attendance', userId, ATTENDANCE_REWARD);
  return 'success';
}

// ── 출석 넛지: 유저별 명령어 10회마다 미출석 시 true ───────────
interface CmdCounter { date: string; count: number; }
const userCmdCount = new Map<string, CmdCounter>();

export function tickNudge(userId: string): boolean {
  const today = getTodayKST();
  const prev = userCmdCount.get(userId);
  const count = (prev?.date === today ? prev.count : 0) + 1;
  userCmdCount.set(userId, { date: today, count });
  if (count % 10 !== 0) return false;
  return !hasAttendedToday(userId);
}

// ── 카테고리 추천 넛지: 방별 연속 랜덤퀴즈 5번째에만 true ──────
const roomRandomStreak = new Map<string, number>();

export function needCategoryNudge(roomId: string, isRandom: boolean): boolean {
  if (!isRandom) {
    roomRandomStreak.set(roomId, 0);
    return false;
  }
  const streak = (roomRandomStreak.get(roomId) ?? 0) + 1;
  roomRandomStreak.set(roomId, streak);
  return streak === 5;
}
