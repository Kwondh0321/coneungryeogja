// ── 자모연성 게임 모듈 ──────────────────────────────────────────────────────────
import { pool } from '@workspace/db';

// ── 한글 자모 분해 유틸 ──────────────────────────────────────────────────────
const CHO_LIST  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG_LIST = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG_LIST = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

// 교란 자모 후보 (쌍자음·복합모음 제외, 단순 자모만)
const DISTRACTOR_CHO  = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const DISTRACTOR_JUNG = ['ㅏ','ㅐ','ㅓ','ㅔ','ㅗ','ㅜ','ㅡ','ㅣ','ㅑ','ㅕ','ㅛ','ㅠ'];
const DISTRACTOR_POOL = [...DISTRACTOR_CHO, ...DISTRACTOR_JUNG];

// 교란 자모 추가 개수 (난이도별)
const EXTRA_COUNT: Record < JamoDifficulty, number> = { easy: 2, normal: 3, hard: 4 };

export function decomposeToJamo(word: string): string[] {
  const jamo: string[] = [];
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) { jamo.push(ch); continue; }
    const jong = code % 28;
    const jung = Math.floor(code / 28) % 21;
    const cho  = Math.floor(code / 28 / 21);
    jamo.push(CHO_LIST[cho], JUNG_LIST[jung]);
    if (jong > 0) jamo.push(JONG_LIST[jong]);
  }
  return jamo;
}

export function hasJongseong(word: string): boolean {
  for (const ch of word) {
    const code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) continue;
    if (code % 28 !== 0) return true;
  }
  return false;
}

export function canFormFromJamo(word: string, availableJamo: string[]): boolean {
  const wordJamo = decomposeToJamo(word);
  const pool = [...availableJamo];
  for (const j of wordJamo) {
    const idx = pool.indexOf(j);
    if (idx === -1) return false;
    pool.splice(idx, 1);
  }
  return true;
}

/**
 * 정답 자모 + 교란 자모를 섞어 표시용 자모 풀을 만든다.
 * 교란 자모는 DISTRACTOR_POOL에서 무작위로 선택 (정답 자모와 중복 허용).
 */
function buildExpandedJamo(answerJamo: string[], difficulty: JamoDifficulty): string[] {
  const extraCount = EXTRA_COUNT[difficulty];
  const shuffledPool = [...DISTRACTOR_POOL].sort(() => Math.random() - 0.5);
  const extras = shuffledPool.slice(0, extraCount);
  const combined = [...answerJamo, ...extras];
  // 피셔-예이츠 셔플
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined;
}

// ── 세션 타입 ──────────────────────────────────────────────────────────────
export type JamoDifficulty = 'easy' | 'normal' | 'hard';

export interface JamoSession {
  roomId:   string;
  userId:   string;
  choices:  string[];  // 4가지 선택지 (섞인 순서)
  correctIdx: number;  // 0~3
  jamo:     string[];  // 표시할 자모 목록 (정답 자모 + 교란 자모 혼합)
  answer:   string;    // 정답 단어
  difficulty: JamoDifficulty;
  basePts:  number;
  hasJong:  boolean;
  wordLen:  number;
  startedAt: Date;
  expiresAt: Date;
  processed?: boolean; // 이중 처리 방지
}

// ── 설정값 (하드코딩 대신 상수로 분리) ─────────────────────────────────────
export const JAMO_CONFIG = {
  EXPIRY_MS: 3 * 60 * 1000, // 3분
  BASE_PTS: {
    easy:   1780,
    normal: 2670,
    hard:   4000,
  },
  BONUS_LONG_WORD:      670,  // 3글자 이상 보너스 — v3.6 A100
  BONUS_JONGSEONG:      440,  // 받침 포함 보너스 — v3.6 A100
  BONUS_FIRST_TODAY:   1110,  // 하루 첫 자모연성 보너스 — v3.6 A100
  BONUS_STREAK_3:      2220,  // 연속 3회 보너스 — v3.6 A100
  WORD_LEN: {
    easy:   2,
    normal: 3,
    hard:   4,
  },
} as const;

// ── 세션 저장소 (인메모리) ─────────────────────────────────────────────────
const jamoSessions = new Map<string, JamoSession>();

export function getJamoSession(roomId: string): JamoSession | undefined {
  const s = jamoSessions.get(roomId);
  if (!s) return undefined;
  if (s.processed || Date.now() >= s.expiresAt.getTime()) { jamoSessions.delete(roomId); return undefined; }
  return s;
}

export function clearJamoSession(roomId: string): void {
  jamoSessions.delete(roomId);
}

export function getAllJamoSessions(): JamoSession[] {
  const now = Date.now();
  const active: JamoSession[] = [];
  for (const [roomId, s] of jamoSessions) {
    if (s.processed || now >= s.expiresAt.getTime()) {
      jamoSessions.delete(roomId);
    } else {
      active.push(s);
    }
  }
  return active;
}

// ── 문제 생성 ──────────────────────────────────────────────────────────────
export async function generateJamoQuestion(
  roomId:     string,
  userId:     string,
  difficulty: JamoDifficulty,
): Promise<JamoSession | null> {
  const wordLen = JAMO_CONFIG.WORD_LEN[difficulty];

  // 정답 단어 뽑기
  const answerRes = await pool.query<{ word: string }>(
    `SELECT word FROM dict_words WHERE word_len = $1 ORDER BY RANDOM() LIMIT 1`,
    [wordLen],
  );
  if (!answerRes.rows.length) return null;
  const answer = answerRes.rows[0].word;

  // 정답 자모 분해 후 교란 자모를 더해 표시용 풀 생성
  const answerJamo   = decomposeToJamo(answer);
  const expandedJamo = buildExpandedJamo(answerJamo, difficulty);

  // 오답 단어 뽑기 — 확장된 자모 풀로 조합 불가한 단어만 선택
  const wrongLenMin = Math.max(2, wordLen - 1);
  const wrongLenMax = wordLen + 1;
  const candidatesRes = await pool.query<{ word: string }>(
    `SELECT word FROM dict_words WHERE word_len BETWEEN $1 AND $2 AND word != $3 ORDER BY RANDOM() LIMIT 80`,
    [wrongLenMin, wrongLenMax, answer],
  );
  const wrongWords: string[] = [];
  for (const row of candidatesRes.rows) {
    if (wrongWords.length >= 3) break;
    // 확장 풀로도 조합 불가해야 진짜 오답
    if (!canFormFromJamo(row.word, expandedJamo)) wrongWords.push(row.word);
  }
  // 부족하면 완화 조건으로 보충 (정답 자모로만 체크)
  for (const row of candidatesRes.rows) {
    if (wrongWords.length >= 3) break;
    if (!wrongWords.includes(row.word) && row.word !== answer
        && !canFormFromJamo(row.word, answerJamo)) {
      wrongWords.push(row.word);
    }
  }
  // 그래도 부족하면 단순 필터로 채움
  for (const row of candidatesRes.rows) {
    if (wrongWords.length >= 3) break;
    if (!wrongWords.includes(row.word) && row.word !== answer) wrongWords.push(row.word);
  }
  if (wrongWords.length < 3) return null;

  // 4가지 선택지 섞기
  const allChoices = [answer, ...wrongWords.slice(0, 3)];
  const shuffled = allChoices.sort(() => Math.random() - 0.5);
  const correctIdx = shuffled.indexOf(answer);

  const session: JamoSession = {
    roomId, userId,
    choices: shuffled,
    correctIdx,
    jamo: expandedJamo,   // 교란 자모 포함 혼합 풀
    answer,
    difficulty,
    basePts:  JAMO_CONFIG.BASE_PTS[difficulty],
    hasJong:  hasJongseong(answer),
    wordLen,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + JAMO_CONFIG.EXPIRY_MS),
  };
  jamoSessions.set(roomId, session);
  return session;
}

// ── 정답 처리 ─────────────────────────────────────────────────────────────
export interface JamoRewardResult {
  correct: boolean;
  answer:  string;
  pts:     number;
  bonuses: string[];
}

export function calcJamoReward(
  session:     JamoSession,
  choiceIdx:   number,
  streak:      number,
  isFirstToday: boolean,
): JamoRewardResult {
  const correct = choiceIdx === session.correctIdx;
  if (!correct) return { correct: false, answer: session.answer, pts: 0, bonuses: [] };

  let pts = session.basePts;
  const bonuses: string[] = [];

  if (session.wordLen >= 3)  { pts += JAMO_CONFIG.BONUS_LONG_WORD;   bonuses.push(`+${JAMO_CONFIG.BONUS_LONG_WORD}P (${session.wordLen}글자 보너스)`); }
  if (session.hasJong)       { pts += JAMO_CONFIG.BONUS_JONGSEONG;   bonuses.push(`+${JAMO_CONFIG.BONUS_JONGSEONG}P (받침 보너스)`); }
  if (isFirstToday)          { pts += JAMO_CONFIG.BONUS_FIRST_TODAY; bonuses.push(`+${JAMO_CONFIG.BONUS_FIRST_TODAY}P (첫 자모연성 보너스)`); }
  const newStreak = streak + 1;
  if (newStreak % 3 === 0)   { pts += JAMO_CONFIG.BONUS_STREAK_3;    bonuses.push(`+${JAMO_CONFIG.BONUS_STREAK_3}P (연속 ${newStreak}회 보너스)`); }

  return { correct: true, answer: session.answer, pts, bonuses };
}

// ── 자모 표시 포맷 ─────────────────────────────────────────────────────────
export function formatJamoList(jamo: string[]): string {
  return jamo.join('  ');
}

// ── 선택지 표시 포맷 ─────────────────────────────────────────────────────────
export function formatChoices(choices: string[]): string {
  return choices.map((c, i) => `${i + 1}. ${c}`).join('\n');
}
