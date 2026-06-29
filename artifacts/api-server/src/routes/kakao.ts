import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import {
  getSession,
  createSession,
  endSession,
  suspendSession,
  getCurrentQuiz,
  checkAnswer,
  recordScore,
  recordWrong,
  recordHunminStats,
  recordRoomScore,
  getRanking,
  getRoomRanking,
  getUserScore,
  adminAddScore,
  getServerRank,
  getRoomRank,
  hasAttendedToday,
  recordAttendance,
  ATTENDANCE_REWARD,
  quizBank,
  resetSessionTimer,
  TIMEOUT_MS,
  buildHintDisplay,
  buildHintDisplayRandom,
  calcMaxHints,
  getKoreanCharIndices,
  deductFragments,
  refundPoints,
  // 훈민정음 멀티플레이
  createHunminSession,
  getHunminSession,
  endHunminSession,
  registerHunminParticipant,
  transitionToPlaying,
  isPlayingOver,
  getRemainingPlaySec,
  validateHunminWord,
  getHunminCandidateWords,
  calcMvps,
  rewardHunminWord,
  HUNMIN_WORD_REWARD,
  HUNMIN_MVP_BONUS,
  REGISTRATION_CANCEL_MS,
  PLAYING_MS,
  isAdminUser,
  isSubAdminUser,
  getFixedNickname,
  sendGiftFragments,
  ensureUserInRankingBoard,
  GIFT_DAILY_MAX,
  GIFT_DAILY_LIMIT,
  getRemainingGiftFragments,
  getRemainingGiftCount,
  getAllSessions,
  getAllHunminSessions,
  nextQuiz,
  tickNudge,
  needCategoryNudge,
  getChosung,
  generateAutoNickname,
  changeNickname,
  incrementQuizAttempt,
  incrementQuizCorrect,
  adminChangeNickname,
  logDailyActive,
  type HunminSession,
} from "../lib/gameState";
import { checkNicknameWithLog } from "../lib/nicknameFilter";
import { pool, db } from "@workspace/db";
import {
  updateJamoStreak,
  isFirstJamoToday,
  getLastJamoDate,
  updateRelicInvLimit,
  recordWin,
  isComboActive,
  getComboRemainingSeconds,
  getComboWinCount,
} from "../lib/gameState";
import {
  generateJamoQuestion,
  getJamoSession,
  getAllJamoSessions,
  clearJamoSession,
  calcJamoReward,
  formatJamoList,
  formatChoices,
  JAMO_CONFIG,
  type JamoDifficulty,
} from "../lib/jamoGame";
import {
  startTypingSession,
  getTypingSession,
  clearTypingSession,
  calcTypingResult,
} from "../lib/typingGame";
import {
  getUserRelics,
  getUserInventory,
  setMainRelic,
  enhanceRelic,
  levelUpRelic,
  fuseRelics,
  fuseCostLabel,
  sellRelic,
  dismantleRelic,
  expandInventory,
  getRelicEffects,
  getRelicEffectsDetailed,
  formatRelicInfo,
  getRelicCount,
  getRelicInvLimitDB,
  createGachaRelic,
  createEventRelic,
  getRelicName,
  getNewRelicImageUrl,
  getAllUserRelicPowers,
  RELIC_TYPE_CATALOG,
  RELIC_CONFIG,
  GRADE_NAMES,
  GRADE_STARS,
  calcEffectValue,
  calcFuseSuccessRate,
  calcSSFuseSuccessRate,
  type RelicGrade,
} from "../lib/newRelicSystem";
import {
  computeReward,
} from "../lib/artifactState";
import { getDailyMetrics, formatMetrics, format14DaySummary } from "../lib/monitoring";
import {
  BATTLE_CONFIG,
  getDailyBattleCount,
  incrementBattleCount,
  updateBattleOutcome,
  recordBattleResult,
  conductBattle,
  calcBattlePower,
  getUserBattleStats,
} from "../lib/battleSystem";
import { getTopTitle, type TitleInput } from "../lib/titles";
import {
  calculateEffectiveBattlePower,
  getAllEffectiveBattlePowers,
  getUserRelicAssetValue,
  getAllUserRelicAssets,
} from "../lib/newRelicSystem";

const HINT_COST = 100;

// ── 프로필 웹 링크 베이스 URL ────────────────────
// REPLIT_DOMAINS는 쉼표 구분 배열, 첫 번째 도메인 우선 사용
const PROFILE_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://chosung.app'
  : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://chosung.app';

// ── 숫자 포맷 (세 자리 콤마) ────────────────────
function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function scoreDisplay(score: number): string {
  return `${fmt(score)}P`;
}

function getScoreTitle(topPct: number): string {
  if (topPct <= 1)  return "전설의 초능력자";
  if (topPct <= 10) return "마스터 능력자";
  if (topPct <= 30) return "고수 능력자";
  if (topPct <= 50) return "중급 능력자";
  if (topPct <= 70) return "신진 능력자";
  return "초보 능력자";
}
function calcTopPct(rankIdx: number, total: number): number {
  if (rankIdx < 0 || total === 0) return 100;
  return Math.ceil(((rankIdx + 1) / total) * 100);
}

const router: IRouter = Router();

// ── 재시작 공지 ──────────────────────────────────
const SERVER_START_MS = Date.now();
const RESTART_NOTICE_WINDOW_MS = 60_000; // 60초
const restartNoticedRooms = new Set<string>();

// ── 응답 헬퍼 ──────────────────────────────────

type KakaoButton = {
  action: "message" | "webLink" | "mention" | "guide" | "invite";
  label: string;
  messageText?: string;
  webLinkUrl?: string;
};

type KakaoThumbnail = {
  imageUrl: string;
  link?: { web?: string };
  fixedRatio?: boolean;
};

type TextCardItem = {
  title?: string;
  description?: string;
  buttons?: KakaoButton[];
  buttonLayout?: "horizontal" | "vertical";
  thumbnail?: KakaoThumbnail;
};

// title을 description 앞줄에 병합 (단일 필드 → 블랙 폰트), buttonLayout 자동 설정
function withLayout(item: TextCardItem): TextCardItem {
  const { title, description, thumbnail, ...rest } = item;
  const merged = title
    ? `${title}\n\n${description ?? ""}`
    : (description ?? "");
  const base = { ...rest, description: merged, ...(thumbnail ? { thumbnail } : {}) };
  if (base.buttonLayout) return base;
  const cnt = base.buttons?.length ?? 0;
  return { ...base, buttonLayout: cnt === 2 ? "horizontal" : "vertical" };
}

// 단일 textCard 응답 (userId 제공 시 카드 앞에 멘션 텍스트 추가)
function textCard(item: TextCardItem, mentionUserId?: string) {
  if (mentionUserId) {
    return {
      version: "2.0",
      template: {
        outputs: [
          { simpleText: { text: `{{#mentions.u}}` } },
          { textCard: withLayout(item) },
        ],
      },
      extra: { mentions: { u: { type: "botUserKey", id: mentionUserId } } },
    };
  }
  return {
    version: "2.0",
    template: { outputs: [{ textCard: withLayout(item) }] },
  };
}

// textCard + 퀵리플라이
function textCardWithQuickReplies(
  item: TextCardItem,
  replies: { label: string; action: string; messageText: string }[]
) {
  return {
    version: "2.0",
    template: {
      outputs: [{ textCard: item }],
      quickReplies: replies,
    },
  };
}


// 복수 output + 멘션 extra
function multiOutput(
  outputs: object[],
  mentions?: Record<string, { type: string; id: string }>,
  quickReplies?: { label: string; action: string; messageText: string }[],
) {
  return {
    version: "2.0",
    template: {
      outputs,
      ...(quickReplies?.length ? { quickReplies } : {}),
    },
    ...(mentions ? { extra: { mentions } } : {}),
  };
}

// 요청마다 계산된 넛지 접미사 (요청 시작 시 세팅, mentionText에서 자동 첨부)
let _activeNudge = "";

function mentionText(template: string) {
  return { simpleText: { text: template + _activeNudge } };
}

// ── TIP 메시지 (게임 정답 15회마다 1번 노출) ──────
const TIP_TEXT = "\n🔮 [TIP] 10분 내 5회 이상 승리하면 콤보 발동! (+20% 60초)";
let _tipCount = 0;

function consumeTip(): string {
  _tipCount++;
  return _tipCount % 15 === 0 ? TIP_TEXT : "";
}

function plainText(text: string) {
  return { simpleText: { text } };
}

function card(item: TextCardItem) {
  return { textCard: withLayout(item) };
}

function basicCard(item: { title?: string; description?: string; imageUrl: string; buttons?: KakaoButton[] }) {
  return {
    basicCard: {
      ...(item.title       ? { title:       item.title }       : {}),
      ...(item.description ? { description: item.description } : {}),
      thumbnail: { imageUrl: item.imageUrl, fixedRatio: true },
      ...(item.buttons?.length ? { buttons: item.buttons } : {}),
    },
  };
}

function basicCardResponse(item: { title?: string; description?: string; imageUrl: string; buttons?: KakaoButton[] }) {
  return multiOutput([basicCard(item)]);
}

// ── 공통: roomId, userId, nickname 추출 ─────────
function extractIds(req: Request): { roomId: string; userId: string; nickname: string } {
  const roomId: string =
    req.body?.userRequest?.chat?.properties?.botGroupKey ??
    req.body?.action?.clientExtra?.botGroupKey ??
    req.body?.action?.params?.roomId ??
    req.body?.userRequest?.chat?.id ??
    "unknown_room";
  const userId: string = req.body?.userRequest?.user?.id ?? "unknown_user";
  const rawNickname: string =
    req.body?.userRequest?.user?.properties?.nickname ??
    generateAutoNickname(userId);
  // 운영진 닉네임 고정
  const nickname = getFixedNickname(userId) ?? rawNickname;
  return { roomId, userId, nickname };
}

// ── 재시작 공지 미들웨어 ──────────────────────────────────
// 서버 재시작 후 60초 이내, 채팅방별 최초 1회에만 공지 카드 반환
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'POST') return next();
  if (Date.now() - SERVER_START_MS >= RESTART_NOTICE_WINDOW_MS) return next();
  const { roomId } = extractIds(req);
  if (restartNoticedRooms.has(roomId)) return next();
  restartNoticedRooms.add(roomId);
  return res.json(multiOutput([
    card({
      title: "⚡ 서버가 방금 재시작되었어요",
      description: [
        "진행 중이던 게임·합성 대기가 초기화되었습니다.",
        "명령어를 다시 입력하면 바로 진행할 수 있어요!",
      ].join("\n"),
    }),
  ]));
});

// ── 발화 전처리: @멘션 제거 ──
function cleanUtterance(raw: string): string {
  return raw.trim().replace(/^@\S+\s*/, "").replace(/^\//, "").trim();
}

// ── 공통 상수 ──────────────────────────────────
const STOP_BTN: KakaoButton        = { action: "message", label: "종료",        messageText: "@초능력자 종료" };
const START_BTN: KakaoButton       = { action: "message", label: "시작",        messageText: "@초능력자 지금시작" };
const REG_BTN: KakaoButton         = { action: "message", label: "참여",  messageText: "@초능력자 참여" };

const MENTION_BTN: KakaoButton     = { action: "mention", label: "단어 제출" };
const HINT_BTN: KakaoButton        = { action: "message", label: "힌트", messageText: "@초능력자 힌트" };
const NEXT_BTN: KakaoButton        = { action: "message", label: "다음문제", messageText: "@초능력자 다음문제" };
const RANKING_BTN: KakaoButton     = { action: "message", label: "랭킹", messageText: "@초능력자 랭킹" };
const CHOSUNG_WIN_BTNS: KakaoButton[] = [
  { action: "message", label: "초성퀴즈", messageText: "@초능력자 초성퀴즈" },
  RANKING_BTN,
];
const HUNMIN_WIN_BTNS: KakaoButton[] = [
  { action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" },
  MENTION_BTN,
];
const NEXT_QUIZ_BTN: KakaoButton    = { action: "message", label: "다음문제", messageText: "@초능력자 다음문제" };
const CHOSUNG_END_BTNS: KakaoButton[] = [RANKING_BTN, NEXT_QUIZ_BTN];
const PROFILE_BTNS: KakaoButton[] = [
  RANKING_BTN,
  { action: "message", label: "출첵", messageText: "@초능력자 출첵" },
];
const RESTART_BTNS: KakaoButton[] = [
  { action: "message", label: "게임하기", messageText: "@초능력자 초성퀴즈" },
  { action: "message", label: "내유물",   messageText: "@초능력자 내유물" },
];
const MENU_REPLIES = [
  { label: "게임하기", action: "message", messageText: "@초능력자 초성퀴즈" },
  { label: "내유물",   action: "message", messageText: "@초능력자 내유물" },
  { label: "랭킹",    action: "message", messageText: "@초능력자 랭킹" },
  { label: "프로필",  action: "message", messageText: "@초능력자 프로필" },
];

// ── 자모연성 버튼 ─────────────────────────────────────────────────────────
const JAMO_BTN_EASY:   KakaoButton = { action: "message", label: "쉬움",   messageText: "@초능력자 자모연성 쉬움" };
const JAMO_BTN_NORMAL: KakaoButton = { action: "message", label: "보통",   messageText: "@초능력자 자모연성 보통" };
const JAMO_BTN_HARD:   KakaoButton = { action: "message", label: "어려움", messageText: "@초능력자 자모연성 어려움" };
const JAMO_BTN_QUIT:   KakaoButton = { action: "message", label: "포기",   messageText: "@초능력자 포기" };
const JAMO_BTN_SUBMIT: KakaoButton = { action: "mention", label: "제출" };
const JAMO_NEXT_BTN:   KakaoButton = { action: "message", label: "다음퀴즈", messageText: "@초능력자 다음퀴즈" };

// 자모연성 종료 후 다음문제 라우팅용 플래그 (roomId → {difficulty, at})
const JAMO_NEXT_TTL = 10 * 60 * 1000; // 10분
const jamoJustFinished = new Map<string, { difficulty: JamoDifficulty; at: number }>();

// ── 유물 최근 이벤트 트래커 (30초 TTL) ────────────────────────────────────
const RELIC_EVENT_TTL = 30_000;
interface RelicEvent { at: number; nick: string; action: string; detail: string; }
const relicEventLog: RelicEvent[] = [];
function logRelicEvent(nick: string, action: string, detail: string): void {
  const now = Date.now();
  relicEventLog.push({ at: now, nick, action, detail });
  const cutoff = now - RELIC_EVENT_TTL;
  while (relicEventLog.length > 0 && relicEventLog[0].at < cutoff) relicEventLog.shift();
}
function getRecentRelicEvents(): RelicEvent[] {
  const cutoff = Date.now() - RELIC_EVENT_TTL;
  return relicEventLog.filter(e => e.at >= cutoff);
}

// ── 신규 유물 버튼 ────────────────────────────────────────────────────────
const RELIC_BTN_INFO:      KakaoButton = { action: "message", label: "내유물",      messageText: "@초능력자 내유물" };

// ── 닉네임 변경 ──────────────────────────────────────────────────────────
// userId → 닉네임 변경 대기 중(true)
const pendingNickChange = new Map<string, true>();

// 유물보관함 조회 시 표시 순서(번호) → 실제 relicId 매핑 (유저별 캐시)
const relicStorageMap = new Map<string, number[]>();

// 합성 대기 상태 (userId → 대기 재료 목록)
interface PendingFuse {
  grade: RelicGrade;
  gradeLetter: string;
  relics: Array<{
    relicId: number;
    typeId: number;
    grade: RelicGrade;
    enhance: number;
    level: number;
    effectValue: string | number;
  }>;
}
const pendingFuseMap = new Map<string, PendingFuse>();

const RELIC_BTN_UPGRADE:   KakaoButton = { action: "message", label: "유물강화",    messageText: "@초능력자 유물강화" };
const RELIC_BTN_FUSE:      KakaoButton = { action: "message", label: "유물합성",    messageText: "@초능력자 유물합성" };
const RELIC_BTN_FUSE_GO:   KakaoButton = { action: "message", label: "합성진행",    messageText: "@초능력자 합성진행" };
const RELIC_BTN_DISMANTLE: KakaoButton = { action: "message", label: "유물판매",    messageText: "@초능력자 유물판매" };
const RELIC_BTN_BREAK:     KakaoButton = { action: "message", label: "유물분해",    messageText: "@초능력자 유물분해" };
const RELIC_BTN_STORAGE:   KakaoButton = { action: "message", label: "유물보관함",  messageText: "@초능력자 유물보관함" };
const RELIC_BTN_EXPAND:    KakaoButton = { action: "message", label: "보관함확장",  messageText: "@초능력자 보관함확장" };
const RELIC_BTN_GACHA:     KakaoButton = { action: "message", label: "유물뽑기",    messageText: "@초능력자 유물뽑기" };

// ── 초성퀴즈 주제 목록 (quizBank에서 동적 추출) ──
function getQuizCategories(): string[] {
  return [...new Set(quizBank.map((q) => q.category))].sort();
}
function getCategoryCountMap(): Map<string, number> {
  const m = new Map<string, number>();
  for (const q of quizBank) m.set(q.category, (m.get(q.category) ?? 0) + 1);
  return m;
}
function getCategoryListText(): string {
  const cnt = getCategoryCountMap();
  return getQuizCategories().map((c) => `${c} (${cnt.get(c) ?? 0}개)`).join("\n");
}

// 정답률 포맷 (attempt 0이면 "첫 출제")
function fmtRate(attemptCount: number, correctCount: number): string {
  if (attemptCount === 0) return "첫 출제";
  return `${Math.round((correctCount / attemptCount) * 100)}%`;
}

// utterance에서 초성퀴즈 카테고리 파싱. "초성퀴즈 한국사" → "한국사"
function parseChosungCategory(utterance: string): string | null {
  const cats = getQuizCategories();
  const prefix = ["초성퀴즈 ", "퀴즈 "];
  for (const p of prefix) {
    if (utterance.startsWith(p)) {
      const cat = utterance.slice(p.length).trim();
      if (cats.includes(cat)) return cat;
    }
  }
  return null;
}

// ── 남은 시간 ──────────────────────────────────
function getRemainingTime(questionStartedAt: Date): string {
  const remainMs = Math.max(0, TIMEOUT_MS - (Date.now() - questionStartedAt.getTime()));
  const totalSec = Math.floor(remainMs / 1000);
  return `${Math.floor(totalSec / 60)}분 ${totalSec % 60}초`;
}

// ── 파편 계산 (하위 호환 유지) ──────────────────
function calcScore(wrongCount: number): number {
  return Math.max(10, 100 - wrongCount * 10);
}

// ── 자동 힌트: 미공개 한글 1글자를 랜덤으로 공개 ──
function autoRevealHint(session: import('../lib/gameState').GameSession, answer: string): string {
  const koreanIndices = getKoreanCharIndices(answer);
  const unrevealed = koreanIndices.filter(i => !session.revealedKoreanIndices.includes(i));
  if (unrevealed.length > 0) {
    const picked = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    session.revealedKoreanIndices.push(picked);
  }
  return buildHintDisplayRandom(answer, new Set(session.revealedKoreanIndices));
}

// ── 랭킹 응답 빌더 ─────────────────────────────
type UserScore = { userId: string; nickname: string; score: number };

const MEDALS = ["🥇", "🥈", "🥉"];
function rankLabel(i: number): string {
  return i < 3 ? MEDALS[i] : `[${i + 1}위]`;
}

// ── 초능력자 점수 = score(실시간) + base(유물+전투력, 5분 갱신) ─────────────
//   base 컴포넌트만 주기적으로 갱신하고, score는 항상 메모리에서 실시간으로 읽음
const _spBaseMap = new Map<string, number>(); // userId → relicAsset + log(power)*logK
let _spBaseTs = 0;
const SP_BASE_TTL_MS = 5 * 60 * 1000;

async function refreshSpBase(): Promise<void> {
  try {
    const [assetMap, powerMap] = await Promise.all([
      getAllUserRelicAssets(),
      getAllEffectiveBattlePowers(),
    ]);
    const logK = Number(process.env["RANKING_BATTLE_POWER_LOG_WEIGHT"] ?? 100_000);
    for (const u of getRanking()) {
      const relicAsset = assetMap.get(u.userId) ?? 0;
      const power      = powerMap.get(u.userId)?.totalPower ?? 0;
      _spBaseMap.set(u.userId, relicAsset + Math.round(logK * Math.log10(1 + power)));
    }
    _spBaseTs = Date.now();
  } catch { /* 무시 */ }
}

function ensureSpBase(): void {
  if (Date.now() - _spBaseTs > SP_BASE_TTL_MS) void refreshSpBase();
}

/** base 컴포넌트가 1회 이상 로드됐는지 여부 */
function spBaseLoaded(): boolean {
  return _spBaseMap.size > 0;
}

/** 특정 유저의 초능력자 점수 (score 실시간 반영) */
function getSpScore(userId: string): number {
  ensureSpBase();
  const score = getUserScore(userId)?.score ?? 0;
  return score + (_spBaseMap.get(userId) ?? 0);
}

/** 전체 초능력자 랭킹 — 매 호출마다 현재 score 기준으로 정렬 (실시간) */
function getSpRanking(): { userId: string; nickname: string; spScore: number }[] {
  ensureSpBase();
  return getRanking()
    .map(u => ({ userId: u.userId, nickname: u.nickname, spScore: u.score + (_spBaseMap.get(u.userId) ?? 0) }))
    .sort((a, b) => b.spScore - a.spScore);
}

// 초능력자 전체 순위 라인 (동기, 실시간)
function spServerRankLine(userId: string): string {
  const ranking = getSpRanking();
  const idx = ranking.findIndex(u => u.userId === userId);
  if (idx < 0) return "";
  const num = idx + 1;
  if (num === 1) return `🌟 초능력자 순위 : 1위`;
  const myScore    = ranking[idx]!.spScore;
  const aboveScore = ranking[idx - 1]!.spScore;
  const gap = Math.max(0, aboveScore - myScore);
  return gap > 0
    ? `🌟 초능력자 순위 : ${num}위\n   └ ${num - 1}위까지 ${fmt(gap)}점 남음`
    : `🌟 초능력자 순위 : ${num}위`;
}

// 초능력자 방 순위 라인 (동기, 실시간)
function spRoomRankLine(userId: string, roomId: string): string {
  const roomMembers = new Set(getRoomRanking(roomId).map(u => u.userId));
  const roomSp = getSpRanking().filter(u => roomMembers.has(u.userId));
  const idx = roomSp.findIndex(u => u.userId === userId);
  if (idx < 0) return "";
  const num = idx + 1;
  if (num === 1) return `🌟 방 순위 : 1위`;
  const myScore    = roomSp[idx]!.spScore;
  const aboveScore = roomSp[idx - 1]!.spScore;
  const gap = Math.max(0, aboveScore - myScore);
  return gap > 0
    ? `🌟 방 순위 : ${num}위\n   └ ${num - 1}위까지 ${fmt(gap)}점 남음`
    : `🌟 방 순위 : ${num}위`;
}

async function buildRankingResponse(roomId: string, userId: string, nickname: string) {
  // base 컴포넌트가 아직 로드되지 않은 경우 직접 await (서버 재시작 직후 대응)
  if (!spBaseLoaded()) await refreshSpBase();
  const serverRanking = getRanking();
  const roomRanking   = getRoomRanking(roomId);

  const rankCard = card({
    title: "🏆 랭킹 시스템",
    buttons: [
      { action: "message", label: "프로필",   messageText: "@초능력자 프로필" },
      { action: "webLink", label: "전체 랭킹", webLinkUrl: `https://rank.chosung.app/?uid=${encodeURIComponent(userId)}` },
    ],
  });

  if (serverRanking.length === 0 && roomRanking.length === 0) {
    return multiOutput([
      plainText("🌟 초능력자 랭킹 🌟\n\n아직 기록이 없어요!\n게임을 플레이하면 랭킹에 등록돼요."),
      rankCard,
    ]);
  }

  const mentions: Record<string, { type: string; id: string }> = {};
  const lines: string[] = ["🌟 초능력자 랭킹 [포인트 + 유물자산 + 전투력]"];

  // 🌟 초능력자 전체 순위 top5 (실시간)
  const spRanking = getSpRanking();
  lines.push("\n🌟 초능력자 전체 순위");
  if (!spBaseLoaded()) {
    lines.push("집계 중이에요. 잠시 후 다시 시도해주세요!");
  } else {
    spRanking.slice(0, 5).forEach((u, i) => {
      lines.push(`${rankLabel(i)} ${u.nickname} : ${fmt(u.spScore)}점`);
    });
  }

  // 🌟 초능력자 방 순위 — 실제 @멘션 (5위까지, 실시간)
  lines.push("\n🌟 초능력자 방 순위");
  const roomUserIds   = new Set(roomRanking.map(u => u.userId));
  const roomSpRanking = spRanking.filter(e => roomUserIds.has(e.userId)).slice(0, 5);
  if (roomRanking.length === 0) {
    lines.push("이 방의 기록 없음");
  } else if (!spBaseLoaded()) {
    lines.push("집계 중이에요. 잠시 후 다시 시도해주세요!");
  } else {
    roomSpRanking.forEach((u, i) => {
      const key = `r${i + 1}`;
      mentions[key] = { type: "botUserKey", id: u.userId };
      lines.push(`${rankLabel(i)} {{#mentions.${key}}} : ${fmt(u.spScore)}점`);
    });
  }

  // 내 초능력자 순위
  mentions["me"] = { type: "botUserKey", id: userId };
  const myScore    = getUserScore(userId)?.score ?? 0;
  const myNick     = getUserScore(userId)?.nickname ?? nickname;
  const totalCount = serverRanking.length;
  lines.push("");
  const spLine = spServerRankLine(userId);
  if (spLine) {
    lines.push(`{{#mentions.me}} 님 (${myNick})`);
    lines.push(`포인트 : ${fmt(myScore)}P`);
    lines.push(`점수 : ${fmt(getSpScore(userId))}점`);
    lines.push(spLine);
  } else if (!spBaseLoaded()) {
    lines.push(`{{#mentions.me}} 님 (${myNick}) — 초능력자 순위 집계 중`);
  } else {
    lines.push(`{{#mentions.me}} 님은 아직 초능력자 랭킹에 없어요 (전체 ${fmt(totalCount)}명)`);
    lines.push("게임에서 포인트를 모으면 등록돼요!");
  }

  return multiOutput(
    [mentionText(lines.join("\n")), rankCard],
    mentions
  );
}

// ── 유물 효과 % 브레이크다운 표시 헬퍼 ───────────────
function relicBreakdownLine(mainPct: number, storagePct: number): string {
  if (mainPct === 0 && storagePct === 0) return '';
  const parts: string[] = [];
  if (mainPct    > 0) parts.push(`메인 +${mainPct}%`);
  if (storagePct > 0) parts.push(`보관함 +${storagePct}%`);
  return `🏛️ 유물 효과: ${parts.join(' + ')} 적용 중`;
}

// ── 종료 카드 ──────────────────────────────────
function endCard(
  _session: { correct: number; total: number; score: number },
  answer?: string,
  userId?: string,
  roomId?: string
) {
  if (userId) {
    const rankLines  = [
      spServerRankLine(userId),
      roomId ? spRoomRankLine(userId, roomId) : "",
    ].filter(Boolean).join("\n");
    const mentionLines = [
      `🔮 {{#mentions.u}} 게임 종료!`,
      ...(answer ? [`정답은 "${answer}" 이에요!`] : []),
      ...(rankLines ? [rankLines] : []),
    ].join("\n");
    return multiOutput(
      [
        mentionText(mentionLines),
        card({ title: "초성퀴즈", buttons: CHOSUNG_END_BTNS }),
      ],
      { u: { type: "botUserKey", id: userId } },
    );
  }
  const desc = answer ? `정답은 "${answer}" 이에요!` : "수고하셨어요!";
  return textCard({ title: "🔮 초성퀴즈", description: desc, buttons: CHOSUNG_END_BTNS });
}

// ── 오답 응답 ──────────────────────────────────
function wrongResponse(userId: string, remainingTime: string, wrongCount: number, pts: number, hint?: string, hintsLeft = true) {
  const hintLine = hint
    ? `💡 힌트 : ${hint}`
    : `💡 무료 힌트까지 ${Math.max(0, 5 - wrongCount)}회 남음`;
  const buttons: KakaoButton[] = hintsLeft ? [HINT_BTN, MENTION_BTN] : [NEXT_BTN, MENTION_BTN];
  return multiOutput(
    [
      mentionText(`😅 {{#mentions.player}}님, 아쉬워요! 한 번 더 도전해보세요.`),
      card({
        title: `💰 지금 맞히면 ${scoreDisplay(pts)} 획득!`,
        description: [
          `❌ 오답 횟수 : ${wrongCount}회`,
          `⏳ 남은 시간 : ${remainingTime}`,
          ``,
          `${hintLine}`,
        ].join("\n"),
        buttons,
      }),
    ],
    { player: { type: "botUserKey", id: userId } }
  );
}

// ── 정답 응답 (세션 종료 포함) ─────────────────
function correctResponse(
  roomId: string,
  userId: string,
  pointsGained: number,
  totalScore: number,
  correct: number,
  total: number,
  opts: {
    comboTriggered?: boolean; comboBonus?: boolean; basePts?: number;
    artifactBonusPct?: number; comboPct?: number;
  } = {}
) {
  const bonusAmt = (opts.basePts !== undefined && pointsGained > opts.basePts)
    ? pointsGained - opts.basePts : 0;
  const gainText = bonusAmt > 0
    ? `${fmt(pointsGained)} [${fmt(opts.basePts!)}+보너스 ${fmt(bonusAmt)}]`
    : fmt(pointsGained);
  const comboActive = isComboActive(userId);
  const comboWins   = getComboWinCount(userId);
  const comboLine = opts.comboTriggered
    ? `🔥 콤보 발동! +${opts.comboPct ?? 20}% (60초간)`
    : comboActive
      ? `🔥 콤보 진행 중 (+20%, ${getComboRemainingSeconds(userId)}초 남음)`
      : comboWins > 0
        ? `⚡ 콤보 ${comboWins}/5회 진행 중`
        : "";

  // 전체 맞힌 문제 수 (프로필과 동일)
  const globalCorrect = getUserScore(userId)?.correct ?? correct;

  const rankLines = [
    spServerRankLine(userId),
    spRoomRankLine(userId, roomId),
  ].filter(Boolean).join("\n");

  // 초능력자 점수 (실시간: 방금 얻은 포인트 즉시 반영)
  const mySpScore   = getSpScore(userId);
  const spScoreLine = mySpScore > 0 ? `🌟 초능력자 점수 : ${fmt(mySpScore)}점` : "";

  // 멘션: 정답 + 획득P(개행) + 맞힌 문제 + 콤보
  const gainLine = bonusAmt > 0
    ? `+${fmt(pointsGained)}P\n[기본 ${fmt(opts.basePts!)}+보너스 ${fmt(bonusAmt)}]`
    : `+${fmt(pointsGained)}P`;
  const mentionLine = [
    `🎉 {{#mentions.player}}님 정답!`,
    gainLine,
    `✅ 맞힌 문제 : ${globalCorrect}개`,
    ...(comboLine ? [``, comboLine] : []),
  ].join("\n") + consumeTip();

  // 카드: 순위 요약 (포인트는 타이틀에 표기)
  const cardDesc = rankLines || undefined;

  return multiOutput(
    [
      mentionText(mentionLine),
      card({
        title: `💰 보유 포인트 : ${scoreDisplay(totalScore)}`,
        description: cardDesc || undefined,
        buttons: CHOSUNG_END_BTNS,
      }),
    ],
    { player: { type: "botUserKey", id: userId } }
  );
}

// ──────────────────────────────────────────────
// 초성퀴즈 시작
// POST /api/kakao/chosung/start
// ──────────────────────────────────────────────
router.post("/chosung/start", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);

  await ensureUserInRankingBoard(userId, nickname, roomId);
  logDailyActive(userId);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";
  // 방 최초 방문 기록 (이벤트참여 유효성 검사용)
  void pool.query(
    `INSERT INTO room_first_seen (room_id, first_seen_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING`,
    [roomId],
  );
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // 자모포기 — 최우선 처리 (pendingNickChange·게임 세션보다 앞)
  if (utterance === "자모포기" || utterance === "자모 포기" || utterance === "포기") {
    const jamoSess = getJamoSession(roomId);
    if (!jamoSess) {
      return res.json(multiOutput(
        [
          mentionText(`🔤 {{#mentions.u}} ❌ 진행 중인 자모연성이 없어요.`),
          card({
            title: "자모연성을 시작해주세요!",
            description: "",
            buttons: [
              { action: "message", label: "프로필",   messageText: "@초능력자 프로필" },
              { action: "message", label: "자모연성", messageText: "@초능력자 자모연성" },
            ],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const diff = jamoSess.difficulty;
    clearJamoSession(roomId);
    jamoJustFinished.set(roomId, { difficulty: diff, at: Date.now() });
    return res.json(multiOutput(
      [
        mentionText(`🔤 {{#mentions.u}} 자모연성 포기!`),
        card({
          title: "🔤 자모연성 포기",
          description: [
            `정답은 「${jamoSess.answer}」 이었어요.`,
            `다시 도전해볼까요?`,
          ].join("\n"),
          buttons: [JAMO_NEXT_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 타자포기 — 진행 중인 타자게임 포기
  if (utterance === "타자포기" || utterance === "타자 포기") {
    const typSess = getTypingSession(userId);
    if (!typSess) {
      return res.json(multiOutput(
        [
          mentionText(`⌨️ {{#mentions.u}} 진행 중인 타자게임이 없어요.`),
          card({
            title: "⌨️ 타자게임 없음",
            description: "타자게임을 시작하려면 \"타자게임\"을 입력해주세요.",
            buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    clearTypingSession(userId);
    return res.json(multiOutput(
      [
        mentionText(`⌨️ {{#mentions.u}} 타자게임 포기`),
        card({
          title: "⌨️ 타자게임 포기",
          description: [
            `문장: 「${typSess.sentence}」`,
            `다시 도전해보세요!`,
          ].join("\n"),
          buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 이벤트참여: 오늘 초대된 방인지 체크 후 초대 로그 등록 ──────────────────
  if (utterance === "이벤트참여") {
    // 혼자 있는 방 체크: 그룹 방은 botGroupKey가 존재, 1:1 봇 채팅은 없음
    const isGroupRoom = !!req.body?.userRequest?.chat?.properties?.botGroupKey;
    if (!isGroupRoom) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} ❌ 혼자 있는 방에서는 참여할 수 없어요!`),
          card({
            description: `최소 2명 이상의 방에서 이벤트 참여가 가능해요. 💙`,
            buttons: [{ action: 'invite', label: '다른 방에 초대하기' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // INSERT ON CONFLICT DO NOTHING RETURNING: 방금 생성됐으면 오늘 새 방
    const fsInsert = await pool.query<{ first_seen_at: Date }>(
      `INSERT INTO room_first_seen (room_id, first_seen_at) VALUES ($1, NOW())
       ON CONFLICT (room_id) DO NOTHING RETURNING first_seen_at`,
      [roomId],
    );
    let isNewRoom = (fsInsert.rowCount ?? 0) > 0;
    if (!isNewRoom) {
      const fsSelect = await pool.query<{ first_seen_at: Date }>(
        `SELECT first_seen_at FROM room_first_seen WHERE room_id = $1`,
        [roomId],
      );
      const existingDate = fsSelect.rows[0]?.first_seen_at
        ? new Date(new Date(fsSelect.rows[0].first_seen_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;
      isNewRoom = existingDate === todayKST;
    }

    if (!isNewRoom) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} ❌ 이 방은 오늘 초대된 방이 아니에요!`),
          card({ description: `오늘 새로 초능력자를 초대한 방에서만\n이벤트 참여가 가능해요. 💙` }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const cntRes2 = await pool.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1 AND activity_date = $2::date`,
      [userId, todayKST],
    );
    const currentCount2 = parseInt(cntRes2.rows[0].c, 10);

    if (currentCount2 >= 5) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 오늘은 이미 5곳 모두 초대 완료했어요! 🎉`),
          card({
            description: `💙💙💙💙💙 달성!\n\n아래 버튼을 클릭하여 보상을 받아가세요!`,
            buttons: [{ action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const insertRes2 = await pool.query(
      `INSERT INTO event_invite_log (user_id, room_id, activity_date) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`,
      [userId, roomId, todayKST],
    );

    if ((insertRes2.rowCount ?? 0) === 0) {
      const hearts2 = '💙'.repeat(currentCount2) + '🤍'.repeat(5 - currentCount2);
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 이 방은 이미 참여 완료했어요!`),
          card({
            description: `참여 횟수 : ${hearts2}\n\n아래 버튼을 클릭하여 보상을 받아가세요!`,
            buttons: [
              { action: 'invite', label: '초대하기' },
              { action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' },
            ],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const newCount2 = currentCount2 + 1;
    const hearts2   = '💙'.repeat(newCount2) + '🤍'.repeat(5 - newCount2);
    const tailMsg2  = '\n\n아래 버튼을 클릭하여 보상을 받아가세요!';

    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.u}} 초능력자의 기운이 스며들고 있어요! ⚡`),
        card({
          description: `이벤트 참여 완료!\n참여 횟수 : ${hearts2}${tailMsg2}`,
          buttons: [
            { action: 'invite', label: '초대하기' },
            { action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' },
          ],
        }),
      ],
      { u: { type: 'botUserKey', id: userId } },
    ));
  }

  // ── 에너지흡수 이벤트 명령어 ────────────────────────────────────────────
  if (utterance === "에너지흡수") {
    // 서버 총 이용자 수 & 유저 초대 내역 & 미수령 방 목록 동시 조회
    const [userCountRes, totalInvitedRes, unclaimedRes] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM users`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1`,
        [userId],
      ),
      pool.query<{ room_id: string; activity_date: string }>(
        `SELECT eil.room_id, eil.activity_date::text
         FROM event_invite_log eil
         WHERE eil.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM event_room_claimed erc
           WHERE erc.room_id = eil.room_id AND erc.activity_date = eil.activity_date
         )`,
        [userId],
      ),
    ]);
    const userCount    = parseInt(userCountRes.rows[0].c, 10);
    const totalInvited = parseInt(totalInvitedRes.rows[0].c, 10);
    const displayN     = Math.min(totalInvited, 5);
    const hearts       = '💙'.repeat(displayN) + '🤍'.repeat(5 - displayN);
    const unclaimedRooms = unclaimedRes.rows;

    // 초대한 방이 아예 없음
    if (totalInvited === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 받을 보상이 없어요! 💙`),
          card({ description: `참여 횟수 : 🤍🤍🤍🤍🤍\n\n초능력자를 새 방에 초대하고\n@초능력자 이벤트참여 를 눌러보세요!` }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    // 초대는 했지만 모두 다른 사람이 먼저 수령
    if (unclaimedRooms.length === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 초대한 방의 보상이 이미 모두 수령됐어요!`),
          card({
            description: `참여 횟수 : ${hearts}\n\n다른 사람이 먼저 받아갔어요.\n새 방에 초능력자를 초대해보세요! 💙`,
            buttons: [{ action: 'message', label: '이벤트참여', messageText: '@초능력자 이벤트참여' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    // 방별 선착순 claim 시도
    let available = 0;
    for (const { room_id, activity_date } of unclaimedRooms) {
      const claimRes = await pool.query(
        `INSERT INTO event_room_claimed (room_id, activity_date, user_id) VALUES ($1, $2::date, $3) ON CONFLICT DO NOTHING`,
        [room_id, activity_date, userId],
      );
      if ((claimRes.rowCount ?? 0) > 0) available++;
    }

    // 경쟁 조건: 동시 요청으로 모두 선점됨
    if (available === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 아쉽게도 다른 사람이 먼저 받아갔어요!`),
          card({
            description: `참여 횟수 : ${hearts}\n\n새 방에 초능력자를 초대해서 다시 도전해보세요! 💙`,
            buttons: [{ action: 'message', label: '이벤트참여', messageText: '@초능력자 이벤트참여' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    // 보상 지급: 방 1개당 서버 총 이용자 수 × 1P
    const pointReward = userCount * available;
    refundPoints(userId, nickname, pointReward);

    const relicLines: string[] = [];
    for (let i = 0; i < available; i++) {
      const relic   = await createEventRelic(userId, 2);
      const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === relic.typeId);
      const name    = typeDef?.gradeNames[1] ?? 'C등급 유물';
      relicLines.push(`  🟢 ${name} (+0 Lv.1)`);
    }

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO event_claim_log (user_id, activity_date, claimed_count) VALUES ($1, $2::date, $3)
       ON CONFLICT (user_id, activity_date) DO UPDATE SET claimed_count = event_claim_log.claimed_count + EXCLUDED.claimed_count`,
      [userId, todayKST, available],
    );

    return res.json(multiOutput(
      [
        mentionText(
          `{{#mentions.u}} 능력자의 에너지 증정 완료! 🌀\n\n` +
          `참여 횟수 : ${hearts}\n\n` +
          `현재 ${userCount.toLocaleString()}명의 능력자들이 함께해요!\n` +
          `더 많은 방에 초능력자를 초대할수록 많은 포인트를 받을 수 있어요 💙`,
        ),
        card({
          description:
            `• 포인트 : +${pointReward.toLocaleString()}P\n` +
            `• 유물 : C등급 랜덤 유물 ×${available}\n` +
            relicLines.join('\n'),
          buttons: [
            { action: 'message', label: '유물보관함', messageText: '@초능력자 유물보관함' },
            { action: 'message', label: '프로필', messageText: '@초능력자 프로필' },
          ],
        }),
      ],
      { u: { type: 'botUserKey', id: userId } },
    ));
  }

  // ── 도움말 (chosung/start 라우트) ───────────────────────────────────────
  if (utterance === "초퀴도움말" || utterance === "초성퀴즈도움말") {
    return res.json(multiOutput([plainText(
      "🔮 초성퀴즈 도움말\n\n초성(자음)만 보고 단어를 맞히는 게임이에요!\n\n📌 기본 규칙\n• 화면에 표시된 초성을 보고 정답 단어를 입력하세요.\n• 오답을 입력하면 포인트가 조금씩 줄어요.\n• 5번 이상 틀리면 힌트가 자동으로 공개돼요.\n• 60초 안에 못 맞히면 문제가 자동 종료돼요.\n\n💰 포인트\n• 랜덤 문제: 최대 7,500P\n• 주제 선택: 최대 3,750P\n• 오답마다 포인트 감소 (최소 50P 보장)\n• 힌트 사용: 100P 차감\n\n🔥 콤보\n• 10분 내 5회 이상 정답 → 콤보 발동!\n• 60초간 모든 게임 포인트 +20%\n\n📝 명령어\n• 초성퀴즈 — 게임 시작\n• 초성퀴즈 [카테고리] — 카테고리 지정 시작\n• 초성주제 — 카테고리 목록 보기\n• 다음문제 — 다음 퀴즈로 넘어가기\n• 힌트 — 글자 하나 공개 (100P 차감)\n• 종료 — 게임 종료"
    )]));
  }
  if (utterance === "훈민도움말" || utterance === "훈민정음도움말") {
    return res.json(multiOutput([plainText(
      "📜 훈민정음 도움말\n\n초성과 글자 수 힌트로 단어를 최대한 많이 맞히는 멀티플레이 게임이에요!\n\n📌 기본 규칙\n• '훈민정음'을 입력하면 방이 열려요.\n• 25초 안에 '참여'를 입력해서 참가하세요.\n• 충분한 인원이 모이면 게임이 시작돼요.\n• 45초 동안 최대한 많은 단어를 맞혀요!\n• 이미 맞힌 단어는 다시 사용할 수 없어요.\n\n💰 포인트\n• 단어 1개 정답: 2,500P\n• 가장 많이 맞힌 MVP: +12,000P 보너스\n• 콤보 발동 중이면 전원 +20% 추가!\n\n📝 명령어\n• 훈민정음 — 방 개설\n• 참여 — 게임 참여 등록\n• 시작 — 등록 마감 후 강제 시작 (방장)\n• 힌트 — 글자 힌트 공개 (100P 차감)\n• 종료 — 게임 종료"
    )]));
  }
  if (utterance === "자모도움말" || utterance === "자모연성도움말") {
    return res.json(multiOutput([plainText(
      "🔤 자모연성 도움말\n\n흩어진 한글 자모를 보고 4개 보기 중 단어를 골라 맞히는 게임이에요!\n\n📌 기본 규칙\n• 주어진 자모 조각들로 만들 수 있는 단어를 고르세요.\n• 1, 2, 3, 4 중 하나를 입력하면 돼요.\n• 3분 안에 답하지 않으면 자동 종료돼요.\n\n💰 기본 포인트\n• 쉬움 (2글자): 1,780P\n• 보통 (3글자): 2,670P\n• 어려움 (4글자): 4,000P\n\n⭐ 추가 보너스\n• 3글자 이상 단어: +670P\n• 받침 포함 단어: +440P\n• 오늘 첫 자모연성: +1,110P\n• 연속 3회 정답: +2,220P\n\n📝 명령어\n• 자모연성 — 랜덤 난이도로 시작\n• 자모연성 쉬움 / 보통 / 어려움 — 난이도 지정\n• 1 / 2 / 3 / 4 — 보기 선택\n• 다음퀴즈 — 연속으로 다음 문제 받기\n• 자모포기 — 현재 문제 포기"
    )]));
  }
  if (utterance === "유물도움말") {
    return res.json(multiOutput([plainText(
      "🏛️ 유물 도움말\n\n유물은 게임에서 획득하는 포인트를 영구적으로 높여주는 특별 아이템이에요!\n\n⭐ 유물 등급 (낮은 → 높은)\nD → C → B → A → S → 🔴SS\n등급이 높을수록 포인트 보너스 효과가 강력해요.\nSS등급은 주 효과 외에 all_bonus가 추가로 적용돼요!\n\n🎁 유물 획득\n• 유물뽑기 — 포인트를 소비해 D등급 유물을 획득\n• 게임 승리 시 확률로 드롭\n\n⚒️ 강화 & 레벨업\n• 유물강화 — 최대 +20까지 강화 (실패 가능, 강화 1당 효과 +3%)\n• 유물레벨업 — 최대 30레벨까지 성장 (실패 없음, 레벨 1당 효과 +1%)\n  비용은 등급과 현재 레벨에 비례해 높아져요.\n💡 TIP: 레벨업은 실패가 없으니 포인트가 있다면 언제든 올려두세요!\n\n🔀 유물 합성 (2단계)\n① 유물합성 D/C/B/A/S — 재료 목록 + 성공률 확인\n② 합성진행 — 확인 후 실제 합성 실행\n• 합성제거 번호,번호 — 특정 유물을 재료에서 제거\n• 재료가 많을수록 성공률이 높아져요!\n※ S→SS 합성은 최소 3개, 최대 성공률 45%\n\n💸 유물 분해\n• 유물분해 — 유물을 분해해 포인트 일부 환급\n\n📦 유물 보관함\n• 메인 유물 외 추가 유물을 보관 (효과 약 20% 적용)\n• 유물설정 [ID] — 보관함 유물을 메인으로 교체\n\n📝 명령어\n• 내유물 — 메인 유물 확인\n• 유물보관함 — 보관함 전체 확인\n• 유물뽑기 / 유물강화 / 유물레벨업\n• 유물합성 / 유물분해 / 유물설정 [ID]"
    )]));
  }

  // ── 닉네임 변경 대기 중 처리 (종료 핸들러보다 먼저 체크) ──────────────
  if (pendingNickChange.has(userId)) {
    if (utterance === "취소") {
      pendingNickChange.delete(userId);
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 취소`),
          card({ title: "✏️ 닉네임 변경 취소", description: "닉네임 변경을 취소했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // 그 외 모든 입력 → 새 닉네임으로 처리
    const newNick = utterance;
    pendingNickChange.delete(userId);

    // ① 현재 닉네임과 동일한지 확인
    const myScorePre = getUserScore(userId);
    if (myScorePre && myScorePre.nickname === newNick) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: "현재 사용 중인 닉네임이에요.\n다른 닉네임을 입력해주세요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // ② 닉네임 필터 검사 (차단 시 포인트 소모 없음, 로그 저장)
    const filterResult = checkNicknameWithLog(userId, newNick);
    if (!filterResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: filterResult.reason ?? "사용할 수 없는 닉네임이에요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // ③ 닉네임 변경 (중복 체크 등 포함)
    const changeResult = changeNickname(userId, newNick);
    if (!changeResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: changeResult.errorMsg ?? "알 수 없는 오류가 발생했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    return res.json(multiOutput(
      [
        mentionText(`✅ {{#mentions.u}} 닉네임 변경 완료!`),
        card({ title: "✅ 닉네임 변경 완료", description: `닉네임이 "${newNick}"으로 변경됐어요!` }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 종료 명령 ──
  if (utterance === "종료" || utterance === "그만" || utterance === "끝") {
    const hunmin = getHunminSession(roomId);
    if (hunmin) {
      const mvps = calcMvps(hunmin.roundScores, hunmin.participants);
      const bonus = calcMvpBonus(hunmin, mvps);
      const comboTriggers: { nickname: string }[] = [];
      for (const m of mvps) {
        const mReward = await computeReward(m.userId, bonus, 'hunmin', true);
        const mvpRelicFx = await getRelicEffectsDetailed(m.userId, ['hunmin_bonus', 'all_bonus', 'combo_bonus']);
        const mvpRelicPct = mvpRelicFx.effects.hunminBonus + mvpRelicFx.effects.allBonus + mvpRelicFx.effects.comboBonus;
        const mvpRelicBonus = mvpRelicPct > 0 ? Math.round(mReward.finalReward * mvpRelicPct / 100) : 0;
        rewardHunminWord(roomId, m.userId, m.nickname, mReward.finalReward + mvpRelicBonus);
        if (mReward.regularComboTriggered) comboTriggers.push({ nickname: m.nickname });
      }
      endHunminSession(roomId);
      return res.json(hunminEndResponse(hunmin, comboTriggers, userId));
    }
    const s = getSession(roomId);
    if (s && !s.ended) { const q = getCurrentQuiz(s); suspendSession(roomId); return res.json(endCard(s, q?.answer, userId, roomId)); }
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 진행 중인 게임이 없어요!`),
        card({ title: "🔮 진행 중인 게임이 없어요!", description: "게임을 시작해주세요!" }),
      ],
      { u: { type: "botUserKey", id: userId } },
      MENU_REPLIES,
    ));
  }

  // ── 출석체크 ──
  if (utterance === "출석체크" || utterance === "출첵" || utterance === "ㅊㅊ" || utterance === "ㅊㅅㅊㅋ") {
    const result = recordAttendance(userId, nickname);
    if (result === "already") {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.me}} 님은\n오늘 📅 출석체크를 이미 했어요.\n자정이 되면 다시 출석체크할 수 있어요.`),
          card({ description: `게임을 통해 능력자로 발돋움해요.`, buttons: RESTART_BTNS }),
        ],
        { me: { type: "botUserKey", id: userId } }
      ));
    }
    const newTotal = getUserScore(userId)?.score ?? ATTENDANCE_REWARD;
    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.me}} 님, 출석체크 완료! 🎉`),
        card({
          description: [`✨ +${fmt(ATTENDANCE_REWARD)}P 지급!`, `🔮 누적 포인트 : ${scoreDisplay(newTotal)}`, ``, `자정 이후에 다시 출첵 가능합니다!`].join("\n"),
          buttons: RESTART_BTNS,
        }),
      ],
      { me: { type: "botUserKey", id: userId } }
    ));
  }

  // ── 지금시작 (시작 버튼) ──
  if (utterance === "지금시작" || utterance === "시작") {
    const hunmin = getHunminSession(roomId);
    // 훈민정음 진행 중에 "시작" 입력은 단어 제출로 처리 (초성이 ㅅㅈ 인 경우 등)
    if (!(utterance === "시작" && hunmin?.phase === "playing")) {
      if (!hunmin) {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음이 없어요`),
            card({
              title: "이미 종료됐거나 등록 시간이 초과됐어요.",
              description: "",
              buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      if (hunmin.phase !== "registration") {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 이미 게임이 진행 중이에요`),
            card({
              title: "🔮 이미 게임이 진행 중이에요",
              description: `현재 참여자 : ${hunmin.participants.size}명`,
              buttons: [STOP_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      // 시작 버튼을 누른 사람이 미등록이면 자동 등록
      if (!hunmin.participants.has(userId)) {
        registerHunminParticipant(hunmin, userId, nickname);
      }
      if (hunmin.participants.size < 2) {
        return res.json(multiOutput(
          [
            mentionText(`{{#mentions.u}} 참여자가 부족해요!`),
            card({
              title: "🔮 참여자 부족",
              description: [
                `현재 ${hunmin.participants.size}명 등록됨`,
                `최소 2명이 있어야 시작할 수 있어요.`,
                ``,
                `✅ 다 모이면 "시작"을 꼭 눌러주세요!`,
              ].join("\n"),
              buttons: [REG_BTN, START_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      if (hunmin.registrationTimer) clearTimeout(hunmin.registrationTimer);
      transitionToPlaying(hunmin);
      return res.json(multiOutput(
        [
          mentionText(`🎮 {{#mentions.u}} 님이 게임을 시작했어요!`),
          card({
            title: "🎮 훈민정음 시작!",
            description: [
              `초성 : ${hunmin.chosung}`,
              `참여자 : ${hunmin.participants.size}명`,
              `⏱ 제한시간: 45초`,
            ].join("\n"),
            buttons: [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // "시작" + playing → 아래 단어 제출 핸들러로 이동
  }

  // ── 초성주제 — 정답 체크보다 먼저 처리해야 오라우팅 방지 ──
  if (utterance === "초성주제") {
    return res.json({
      version: "2.0",
      template: { outputs: [plainText(`🔮 초성퀴즈 주제 목록\n\n${getCategoryListText()}`)] },
    });
  }

  // ── 훈민정음 진행 중이면 단어 제출로 처리 ──
  const hunmin = getHunminSession(roomId);
  if (hunmin) {
    await handleHunminSubmit(hunmin, roomId, userId, nickname, utterance, res);
    return;
  }

  // ── 이미 초성퀴즈 진행 중이면 정답으로 처리 (ended 세션은 다음문제로만 처리) ──
  const activeSession = getSession(roomId);
  if (activeSession && !activeSession.ended) {
    const quiz = getCurrentQuiz(activeSession);
    if (quiz) {
      activeSession.lastActivityAt = new Date();
      resetSessionTimer(roomId);
      if (checkAnswer(quiz, utterance)) {
        if (activeSession.lastCreditedQuizId === quiz.id) {
          return res.json(multiOutput([mentionText(`✅ {{#mentions.u}} 이미 처리된 정답이에요.`), card({ title: "✅ 이미 처리된 정답이에요.", description: "다음 문제를 풀어볼까요?" })], { u: { type: "botUserKey", id: userId } }));
        }
        activeSession.lastCreditedQuizId = quiz.id;
        const basePts = activeSession.currentPts;
        const reward = await computeReward(userId, basePts, 'chosung', true);
        const pts = reward.finalReward;
        activeSession.correct += 1;
        activeSession.total += 1;
        incrementQuizAttempt(quiz.id);
        incrementQuizCorrect(quiz.id);
        recordScore(userId, nickname, pts, 'earn_chosung');
        recordRoomScore(roomId, userId, nickname, pts);
        const cumTotal = getUserScore(userId)?.score ?? pts;
        const snapC = activeSession.correct; const snapT = activeSession.total;
        suspendSession(roomId);
        return res.json(correctResponse(roomId, userId, pts, cumTotal, snapC, snapT, { comboTriggered: reward.regularComboTriggered, comboPct: reward.comboPct, basePts }));
      } else {
        const remainMs = Math.max(0, TIMEOUT_MS - (Date.now() - activeSession.questionStartedAt.getTime()));
        if (remainMs === 0) {
          const ans = quiz.answer;
          incrementQuizAttempt(quiz.id);
          suspendSession(roomId);
          return res.json(multiOutput(
            [
              mentionText(`⏰ {{#mentions.u}} 시간이 초과되었어요!`),
              card({
                title: "⏰ 시간이 초과되었어요!",
                description: `3분 내에 맞히지 못했어요.\n정답은 「${ans}」 이었어요.\n다시 도전해볼까요?`,
                buttons: RESTART_BTNS,
              }),
            ],
            { u: { type: "botUserKey", id: userId } },
          ));
        }
        incrementQuizAttempt(quiz.id);
        recordWrong(userId, nickname);
        const penalty = Math.floor(Math.random() * 61) + 40;
        activeSession.currentPts = Math.max(50, activeSession.currentPts - penalty);
        activeSession.currentWrong += 1;
        const remaining = getRemainingTime(activeSession.questionStartedAt);
        const pts = activeSession.currentPts;
        const maxHints = calcMaxHints(quiz.answer);
        const hintsLeft = activeSession.hintsUsed < maxHints;
        const hint = activeSession.revealedKoreanIndices.length > 0
          ? buildHintDisplayRandom(quiz.answer, new Set(activeSession.revealedKoreanIndices))
          : (activeSession.currentWrong >= 5 ? autoRevealHint(activeSession, quiz.answer) : undefined);
        return res.json(wrongResponse(userId, remaining, activeSession.currentWrong, pts, hint, hintsLeft));
      }
    }
  }

  // ── 실제 초성퀴즈 시작 — 명시적 "초성퀴즈[주제]" 요청일 때만 ──
  const CHOSUNG_START_KEYS = ["초성퀴즈", "퀴즈", "ㅊㅅㅋㅈ", "시작"];
  const parsedCat = parseChosungCategory(utterance);
  const isChosungStart = CHOSUNG_START_KEYS.includes(utterance) || parsedCat !== null;

  // "초성퀴즈 알수없는주제" — 주제 존재하지 않을 때 안내
  if (!isChosungStart && utterance.startsWith("초성퀴즈 ")) {
    
    return res.json(multiOutput([
      mentionText(`🔮 {{#mentions.u}} 님, 존재하지 않는 주제에요!`),
      card({
        title: "아래의 초성주제 버튼을 눌러 확인하세요!",
        buttons: [
          { action: "message", label: "초성주제", messageText: "@초능력자 초성주제" },
          { action: "message", label: "초성퀴즈", messageText: "@초능력자 초성퀴즈" },
        ],
      })
    ], { u: { type: "botUserKey", id: userId } }));
  }

  if (!isChosungStart) {
    // 알 수 없는 입력이거나 단순 봇 멘션 → 메뉴 표시
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 안녕하세요 초능력자예요!`),
        card({
          description: "🔮 안녕하세요 초능력자예요!\n게임을 통해 능력자로 발돋움해요.",
          buttons: [
            { action: "message", label: "게임하기", messageText: "@초능력자 초성퀴즈" },
            { action: "message", label: "내유물",   messageText: "@초능력자 내유물" },
            { action: "guide",   label: "도움말" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
      [{ label: "랭킹", action: "message", messageText: "@초능력자 랭킹" }],
    ));
  }

  // 자모연성 진행 중이면 초성퀴즈 차단
  const existingJamoSess = getJamoSession(roomId);
  if (existingJamoSess) {
    return res.json(multiOutput(
      [
        mentionText(`📢 {{#mentions.u}} 자모연성이 진행 중이에요!`),
        card({
          title: "📢 자모연성 진행 중",
          description: [
            "현재 자모연성이 진행 중이에요!",
            `자모: ${formatJamoList(existingJamoSess.jamo)}`,
            "",
            formatChoices(existingJamoSess.choices),
            "",
            "먼저 완료하거나 포기 후 초성퀴즈를 시작해주세요.",
          ].join("\n"),
          buttons: [JAMO_BTN_QUIT, JAMO_BTN_SUBMIT],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }
  jamoJustFinished.delete(roomId); // 초성퀴즈 시작 시 자모 TTL 플래그 초기화

  const session = createSession(roomId, userId, "chosung", parsedCat ?? undefined);
  const quiz = getCurrentQuiz(session)!;
  if (isAdminUser(userId)) console.log(`[ADMIN] 초성퀴즈 정답: ${quiz.answer}`);
  const startHintsLeft = calcMaxHints(quiz.answer) > 0;
  const startPts = session.currentPts;
  if (needCategoryNudge(roomId, parsedCat === null)) {
    _activeNudge += "\n🔮 [TIP] /초성퀴즈 '카테고리' 를 입력해보세요!";
  }
  return res.json(multiOutput(
    [
      mentionText(`🔮 {{#mentions.u}} 님이 초성퀴즈를 시작했어요!${consumeTip()}`),
      card({
        title: `🔮 문제 : ${quiz.chosung}`,
        description: [
          parsedCat ? `선택주제 : ${quiz.category}` : `랜덤주제 : ${quiz.category}`,
          `최대상금 : ${startPts}P${getUserScore(userId)?.total === 0 ? " (기본 500P 제공)" : ""}`,
          ``,
          `정답률 : ${fmtRate(quiz.attemptCount, quiz.correctCount)}`,
        ].join("\n"),
        buttons: startHintsLeft ? [HINT_BTN, MENTION_BTN] : [STOP_BTN, MENTION_BTN],
      }),
    ],
    { u: { type: "botUserKey", id: userId } },
  ));
});

// ──────────────────────────────────────────────
// 초성퀴즈 정답 제출
// POST /api/kakao/chosung/submit
// ──────────────────────────────────────────────
router.post("/chosung/submit", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // ── 닉네임 변경 대기 중 처리 (mention 버튼이 이 라우트로 오라우팅될 경우) ──
  if (pendingNickChange.has(userId)) {
    if (utterance === "취소") {
      pendingNickChange.delete(userId);
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 취소`),
          card({ title: "✏️ 닉네임 변경 취소", description: "닉네임 변경을 취소했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const newNick = utterance;
    pendingNickChange.delete(userId);
    const myScorePre = getUserScore(userId);
    if (myScorePre && myScorePre.nickname === newNick) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: "현재 사용 중인 닉네임이에요.\n다른 닉네임을 입력해주세요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const filterResult = checkNicknameWithLog(userId, newNick);
    if (!filterResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: filterResult.reason ?? "사용할 수 없는 닉네임이에요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const changeResult = changeNickname(userId, newNick);
    if (!changeResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: changeResult.errorMsg ?? "알 수 없는 오류가 발생했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    return res.json(multiOutput(
      [
        mentionText(`✏️ {{#mentions.u}} 닉네임 변경 완료!`),
        card({ title: "✏️ 닉네임 변경 완료!", description: `닉네임이 「${newNick}」으로 변경됐어요.` }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  if (utterance === "그만" || utterance === "종료" || utterance === "끝") {
    const session = getSession(roomId);
    if (!session || session.ended) return res.json(multiOutput([mentionText(`🔮 {{#mentions.u}} 진행 중인 게임이 없어요!`), card({ title: "🔮 진행 중인 게임이 없어요!" })], { u: { type: "botUserKey", id: userId } }));
    const quiz = getCurrentQuiz(session);
    suspendSession(roomId);
    return res.json(endCard(session, quiz?.answer, userId, roomId));
  }

  const session = getSession(roomId);
  if (!session) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 진행 중인 초성퀴즈가 없어요!`),
        card({
          title: "🔮 진행 중인 초성퀴즈가 없어요!",
          description: "먼저 게임을 시작해주세요.",
          buttons: [{ action: "message", label: "초성퀴즈", messageText: "@초능력자 초성퀴즈" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  const quiz = getCurrentQuiz(session);
  if (!quiz) { endSession(roomId); return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 오류가 발생했어요. 다시 시작해주세요!`), card({ title: "오류가 발생했어요. 다시 시작해주세요!" })], { u: { type: "botUserKey", id: userId } })); }

  session.lastActivityAt = new Date();
  resetSessionTimer(roomId);

  if (checkAnswer(quiz, utterance)) {
    if (session.lastCreditedQuizId === quiz.id) {
      return res.json(multiOutput([mentionText(`✅ {{#mentions.u}} 이미 처리된 정답이에요.`), card({ title: "✅ 이미 처리된 정답이에요.", description: "다음 문제를 풀어볼까요?" })], { u: { type: "botUserKey", id: userId } }));
    }
    session.lastCreditedQuizId = quiz.id;
    const basePts = session.currentPts;
    const reward = await computeReward(userId, basePts, 'chosung', true);
    const pts = reward.finalReward;
    session.correct += 1;
    session.total += 1;
    incrementQuizAttempt(quiz.id);
    incrementQuizCorrect(quiz.id);
    recordScore(userId, nickname, pts, 'earn_chosung');
    recordRoomScore(roomId, userId, nickname, pts);
    const cumTotal = getUserScore(userId)?.score ?? pts;
    const snapCorrect = session.correct; const snapTotal = session.total;
    suspendSession(roomId);
    return res.json(correctResponse(roomId, userId, pts, cumTotal, snapCorrect, snapTotal, { comboTriggered: reward.regularComboTriggered, comboPct: reward.comboPct, basePts }));
  } else {
    const remainMs = Math.max(0, TIMEOUT_MS - (Date.now() - session.questionStartedAt.getTime()));
    if (remainMs === 0) {
      const ans = quiz.answer;
      incrementQuizAttempt(quiz.id);
      suspendSession(roomId);
      return res.json(multiOutput(
        [
          mentionText(`⏰ {{#mentions.u}} 시간이 초과되었어요!`),
          card({
            title: "⏰ 시간이 초과되었어요!",
            description: `3분 내에 맞히지 못했어요.\n정답은 「${ans}」 이었어요.\n다시 도전해볼까요?`,
            buttons: RESTART_BTNS,
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    incrementQuizAttempt(quiz.id);
    recordWrong(userId, nickname);
    const penalty = Math.floor(Math.random() * 61) + 40;
    session.currentPts = Math.max(50, session.currentPts - penalty);
    session.currentWrong += 1;
    const remaining = getRemainingTime(session.questionStartedAt);
    const pts = session.currentPts;
    const maxHints = calcMaxHints(quiz.answer);
    const hintsLeft = session.hintsUsed < maxHints;
    const hint = session.revealedKoreanIndices.length > 0
      ? buildHintDisplayRandom(quiz.answer, new Set(session.revealedKoreanIndices))
      : (session.currentWrong >= 5 ? autoRevealHint(session, quiz.answer) : undefined);
    return res.json(wrongResponse(userId, remaining, session.currentWrong, pts, hint, hintsLeft));
  }
});

// ── 훈민정음 게임 종료 카드 빌더 ─────────────────────

// 정답 수에 따른 MVP 보너스 계산 (1개=500, 2개=1000, 3개=1500, 4개=2000, 5개=2500, 6개↑=3000) — v3.7
function mvpBonus(count: number): number {
  return Math.min(3000, count * 500);
}

// 몰아주기 방지: 다른 참가자(MVP 제외)가 1개 이상 맞췄을 때만 보너스 지급
function calcMvpBonus(
  session: HunminSession,
  mvps: Array<{ userId: string; count: number }>,
): number {
  if (mvps.length === 0) return 0;
  const totalScores = Array.from(session.roundScores.values()).reduce((s, v) => s + v, 0);
  const mvpTotal = mvps.reduce((s, m) => s + m.count, 0);
  const othersTotal = totalScores - mvpTotal;
  if (othersTotal <= 0) return 0; // 상대방이 1개도 못 맞췄으면 보너스 없음
  return mvpBonus(mvps[0].count);
}

// 25초 뒤 자동 취소 타이머 (등록 시간 초과 시 세션 종료)
function startAutoTimer(session: HunminSession): void {
  if (session.registrationTimer) clearTimeout(session.registrationTimer);
  session.registrationTimer = setTimeout(() => {
    const current = getHunminSession(session.roomId);
    if (!current || current.phase !== "registration") return;
    endHunminSession(session.roomId);
  }, 25_000);
}

function hunminEndResponse(
  session: HunminSession,
  comboTriggers: { nickname: string }[] = [],
  endUserId?: string,
) {
  // 0명인 채로 종료 → 아무도 등록하지 않은 것으로 처리
  if (session.participants.size === 0) {
    const mentions = endUserId ? { u: { type: "botUserKey", id: endUserId } } : undefined;
    return multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 훈민정음 종료!\n아무도 등록하지 않았어요.`),
        card({
          title: "게임을 통해 능력자로 발돋움해요.",
          description: "",
          buttons: RESTART_BTNS,
        }),
      ],
      mentions,
    );
  }

  const isSolo = session.participants.size === 1;
  // 혼자 플레이 시 MVP 없음 (보너스 없음)
  const mvps = isSolo ? [] : calcMvps(session.roundScores, session.participants);

  // 훈민정음 통계 기록 (모든 참가자) — 혼자 플레이는 MVP 승리로 기록하지 않음
  const mvpIds = new Set(mvps.map(m => m.userId));
  for (const [uid, nick] of session.participants.entries()) {
    const words = session.roundScores.get(uid) ?? 0;
    recordHunminStats(uid, nick, words, isSolo ? false : mvpIds.has(uid));
  }

  // 라운드 결과 정렬 (정답 많은 순)
  const scores = Array.from(session.roundScores.entries())
    .map(([uid, cnt]) => ({ uid, nickname: session.participants.get(uid) ?? uid, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  const resultLines = scores.length > 0
    ? scores.map((s, i) => `${rankLabel(i)} ${s.nickname} - ${s.cnt}개`)
    : ["아직 정답자가 없어요!"];

  const mvpBonusAmt = isSolo ? 0 : calcMvpBonus(session, mvps);

  const mentions: Record<string, { type: string; id: string }> = {};
  if (isSolo) {
    const soloUserId = session.participants.keys().next().value as string;
    mentions["u"] = { type: "botUserKey", id: soloUserId };
  } else {
    mvps.forEach((m, i) => {
      mentions[`mvp${i}`] = { type: "botUserKey", id: m.userId };
    });
  }

  const mvpMentionText = isSolo
    ? `🔮 {{#mentions.u}} 훈민정음 종료!\nMVP 보너스 없음`
    : mvps.length > 0
      ? mvpBonusAmt > 0
        ? `🔮 훈민정음 종료!\n🏆 MVP: ${mvps.map((_, i) => `{{#mentions.mvp${i}}}`).join(", ")} 님 +${fmt(mvpBonusAmt)}P!`
        : `🔮 훈민정음 종료!\n🏆 MVP: ${mvps.map((_, i) => `{{#mentions.mvp${i}}}`).join(", ")} 님 (보너스 없음)`
      : "🔮 훈민정음 종료!\n이번 라운드 정답자가 없었어요.";

  const comboLine = comboTriggers.length > 0
    ? `🔥 콤보 발동! ${comboTriggers.map(c => c.nickname).join(", ")} (60초간 포인트 +20%!)`
    : "";

  return multiOutput(
    [
      mentionText(mvpMentionText),
      card({
        title: `초성 : ${session.chosung}`,
        description: [
          ...resultLines,
          ...(comboLine ? [``, comboLine] : []),
        ].join("\n"),
        buttons: RESTART_BTNS,
      }),
    ],
    Object.keys(mentions).length > 0 ? mentions : undefined,
  );
}

// ──────────────────────────────────────────────
// 훈민정음 시작
// POST /api/kakao/hunmin/start
// ──────────────────────────────────────────────
router.post("/hunmin/start", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  await ensureUserInRankingBoard(userId, nickname, roomId);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";

  // 기존 초성퀴즈 세션 체크 (ended 상태면 차단 안 함 — endSession으로 정리 후 훈민정음 시작)
  const chosung = getSession(roomId);
  if (chosung && !chosung.ended) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}}, 초성퀴즈 진행 중!`),
        card({
          title: "🔮 초성퀴즈 진행 중",
          description: `현재 방에서 초성퀴즈가 진행 중이에요!\n먼저 게임을 종료해주세요.`,
          buttons: [STOP_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }
  // ended 세션이 있으면 정리 후 훈민정음 시작
  if (chosung?.ended) endSession(roomId);

  // 초성퀴즈 진행 중이면 차단
  const activeChosung = getSession(roomId);
  if (activeChosung) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}}, 초성퀴즈 진행 중!`),
        card({
          title: "🔮 초성퀴즈 진행 중",
          description: `현재 방에서 초성퀴즈가 진행 중이에요!\n먼저 게임을 종료해주세요.`,
          buttons: [STOP_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 기존 훈민정음 세션 체크
  const existing = getHunminSession(roomId);
  if (existing) {
    const phaseText = existing.phase === "registration"
      ? "참여자 등록 중"
      : "게임 진행 중";
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 이미 훈민정음이 ${phaseText}이에요!`),
        card({
          title: "🔮 훈민정음 진행 중",
          description: `이미 이 방에서 훈민정음이 진행 중이에요.\n현재 단계: ${phaseText}`,
          buttons: [STOP_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  try {
    const session = await createHunminSession(roomId);
    if (isAdminUser(userId)) {
      getHunminCandidateWords(session.chosung, session.wordLen).then((words) => {
        console.log(`[ADMIN] 훈민정음 초성: ${session.chosung} (${session.wordLen}글자) — 가능한 단어 ${words.length}개: ${words.join(", ")}`);
      });
    }
    registerHunminParticipant(session, userId, nickname);
    startAutoTimer(session);

    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 님이 훈민정음을 시작했어요!`),
        card({
          title: "25초 동안 참여자를 모집할게요.",
          description: [
            `✅ 다 모이면 "시작"을 꼭 눌러주세요!`,
            ...(getUserScore(userId)?.total === 0 ? [`기본 제공 포인트 : 500P`] : []),
          ].join("\n"),
          buttons: [REG_BTN, START_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  } catch {
    return res.json(multiOutput(
      [
        mentionText(`❌ {{#mentions.u}} 오류가 발생했어요`),
        card({ title: "❌ 오류가 발생했어요", description: "잠시 후 다시 시도해주세요." }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }
});

// ──────────────────────────────────────────────
// 훈민정음 참여자등록
// POST /api/kakao/hunmin/register
// ──────────────────────────────────────────────
router.post("/hunmin/register", (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";
  const session = getHunminSession(roomId);

  if (!session) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음이 없어요!`),
        card({
          title: "🔮 훈민정음이 없어요",
          description: "먼저 훈민정음을 시작해주세요.",
          buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 이미 게임 중이면
  if (session.phase === "playing") {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 이미 게임이 시작됐어요!`),
        card({
          title: "🎮 훈민정음 진행 중",
          description: [
            `초성 : ${session.chosung}`,
            ``,
            `버튼 또는 @초능력자 를 입력 후 단어를 제출하세요!`,
            `⏱ 남은 시간: ${getRemainingPlaySec(session)}초`,
          ].join("\n"),
          buttons: [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 이미 등록된 사람
  if (session.participants.has(userId)) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 이미 등록되어 있어요!`),
        card({
          title: "✅ 이미 등록됨",
          description: `현재 ${session.participants.size}명 등록 중\n15초 뒤 자동으로 시작됩니다!`,
          buttons: [REG_BTN, START_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 정상 등록
  registerHunminParticipant(session, userId, nickname);

  return res.json(multiOutput(
    [
      mentionText(`🔮 {{#mentions.u}} 참여자 등록 완료!`),
      card({
        description: [
          `현재 ${session.participants.size}명 등록됨`,
          `15초 뒤 자동으로 시작됩니다!`,
        ].join("\n"),
        buttons: [STOP_BTN],
      }),
    ],
    { u: { type: "botUserKey", id: userId } },
  ));
});

// ──────────────────────────────────────────────
// 훈민정음 단어 제출 (공용 핸들러)
// POST /api/kakao/hunmin/submit
// ──────────────────────────────────────────────
async function handleHunminSubmit(
  session: HunminSession,
  roomId: string,
  userId: string,
  nickname: string,
  word: string,
  res: Response,
): Promise<void> {
  // 게임 종료 시간 지남
  if (isPlayingOver(session)) {
    // MVP에게 보너스 지급
    const mvps = calcMvps(session.roundScores, session.participants);
    const bonus = calcMvpBonus(session, mvps);
    const comboTriggers: { nickname: string }[] = [];
    for (const m of mvps) {
      const mReward = await computeReward(m.userId, bonus, 'hunmin', true);
      const mvpRelicFx = await getRelicEffectsDetailed(m.userId, ['hunmin_bonus', 'all_bonus', 'combo_bonus']);
      const mvpRelicPct = mvpRelicFx.effects.hunminBonus + mvpRelicFx.effects.allBonus + mvpRelicFx.effects.comboBonus;
      const mvpRelicBonus = mvpRelicPct > 0 ? Math.round(mReward.finalReward * mvpRelicPct / 100) : 0;
      rewardHunminWord(roomId, m.userId, m.nickname, mReward.finalReward + mvpRelicBonus);
      if (mReward.regularComboTriggered) comboTriggers.push({ nickname: m.nickname });
    }
    endHunminSession(roomId);
    res.json(hunminEndResponse(session, comboTriggers, userId));
    return;
  }

  // 아직 게임 시작 안됨 (registration 단계에서 단어 제출 시도)
  if (session.phase === "registration") {
    res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 아직 시작 전이에요!`),
        card({
          title: "⏳ 시작 대기 중",
          description: `단어 제출은 게임 시작 후에 가능해요.\n"시작" 버튼을 눌러 게임을 시작하세요!`,
          buttons: [START_BTN, STOP_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
    return;
  }

  // 참여자 등록 여부 확인
  if (!session.participants.has(userId)) {
    res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 참여 등록이 안 되어 있어요!`),
        card({
          title: "❌ 참여자 미등록",
          description: `다음 게임에 @초능력자 참여 로 등록해주세요.`,
          buttons: [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
    return;
  }

  // 글자 수 체크
  if ([...word].length !== session.wordLen) {
    res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} ${session.wordLen}글자 단어를 입력해주세요!`),
        card({
          title: "❌ 글자 수 오류",
          description: `초성 : ${session.chosung} (${session.wordLen}글자)\n"${word}"는 ${[...word].length}글자예요.`,
          buttons: [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
    return;
  }

  // 중복 단어 체크
  if (session.usedWords.has(word)) {
    res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 이미 사용된 단어예요!`),
        card({
          title: "❌ 중복 단어",
          description: `"- ${word}"는 이미 다른 참여자가 제출했어요.\n다른 단어를 입력해주세요!`,
          buttons: [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
    return;
  }

  // DB 검증
  let isValid: boolean;
  try {
    isValid = await validateHunminWord(word, session.chosung);
  } catch {
    res.json(textCard({ title: "❌ 오류가 발생했어요", description: "잠시 후 다시 시도해주세요.", buttons: [] }));
    return;
  }
  if (!isValid) {
    res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} "${word}" — 해당 초성의 단어가 아니에요!`),
        card({
          title: "❌ 오답",
          description: [
            `초성 : ${session.chosung}`,
            `"${word}" 목록에 없어요.`,
            ``,
            `⏱ 남은 시간: ${getRemainingPlaySec(session)}초`,
          ].join("\n"),
          buttons: [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
    return;
  }

  // ✔ 정답 처리
  session.usedWords.add(word);
  const prev = session.roundScores.get(userId) ?? 0;
  session.roundScores.set(userId, prev + 1);
  const baseReward = HUNMIN_WORD_REWARD; // 단어 보상 고정값 사용
  const wReward = await computeReward(userId, baseReward, 'hunmin', false);

  // ── 유물 효과 적용 (훈민 보너스 + 전체 보너스 + 콤보 보너스) ────
  const hunminRelicFx = await getRelicEffectsDetailed(userId, ['hunmin_bonus', 'all_bonus', 'combo_bonus']);
  const hunminRelicPct = hunminRelicFx.effects.hunminBonus + hunminRelicFx.effects.allBonus + hunminRelicFx.effects.comboBonus;
  const hunminRelicBonus = hunminRelicPct > 0 ? Math.round(wReward.finalReward * hunminRelicPct / 100) : 0;
  const wordReward = wReward.finalReward + hunminRelicBonus;

  const newTotal = rewardHunminWord(roomId, userId, nickname, wordReward);
  const myCount = prev + 1;
  const wordBonusAmt = wordReward - baseReward;

  const hunminRelicInfo = relicBreakdownLine(hunminRelicFx.mainPct, hunminRelicFx.storagePct);

  const hunminGainLine = wordBonusAmt > 0
    ? `+${fmt(wordReward)}P\n[기본 ${fmt(baseReward)}+보너스 ${fmt(wordBonusAmt)}]`
    : `+${fmt(wordReward)}P`;
  res.json(multiOutput(
    [
      mentionText([
        `🔮 {{#mentions.u}} "${word}" ✔️ 정답!`,
        hunminGainLine,
        ...(hunminRelicInfo ? [hunminRelicInfo] : []),
      ].join("\n") + consumeTip()),
      card({
        title: "🎉 정답!",
        description: [
          `단어 : ${word}`,
          `이번 라운드 : ${myCount}개 정답`,
          ``,
          `💰 누적 포인트 : ${scoreDisplay(newTotal)}`,
          `⏱ 남은 시간 : ${getRemainingPlaySec(session)}초`,
        ].join("\n"),
        buttons: HUNMIN_WIN_BTNS,
      }),
    ],
    { u: { type: "botUserKey", id: userId } },
  ));
}

router.post("/hunmin/submit", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // ── 닉네임 변경 대기 중 처리 (mention 버튼이 이 라우트로 오라우팅될 경우) ──
  if (pendingNickChange.has(userId)) {
    if (utterance === "취소") {
      pendingNickChange.delete(userId);
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 취소`),
          card({ title: "✏️ 닉네임 변경 취소", description: "닉네임 변경을 취소했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const newNick = utterance;
    pendingNickChange.delete(userId);
    const myScorePre = getUserScore(userId);
    if (myScorePre && myScorePre.nickname === newNick) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: "현재 사용 중인 닉네임이에요.\n다른 닉네임을 입력해주세요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const filterResult = checkNicknameWithLog(userId, newNick);
    if (!filterResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: filterResult.reason ?? "사용할 수 없는 닉네임이에요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const changeResult = changeNickname(userId, newNick);
    if (!changeResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: changeResult.errorMsg ?? "알 수 없는 오류가 발생했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    return res.json(multiOutput(
      [
        mentionText(`✏️ {{#mentions.u}} 닉네임 변경 완료!`),
        card({ title: "✏️ 닉네임 변경 완료!", description: `닉네임이 「${newNick}」으로 변경됐어요.` }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 종료 명령 ──
  if (utterance === "종료" || utterance === "그만" || utterance === "끝") {
    const hunmin = getHunminSession(roomId);
    if (hunmin) {
      const mvps = calcMvps(hunmin.roundScores, hunmin.participants);
      const bonus = calcMvpBonus(hunmin, mvps);
      const comboTriggers: { nickname: string }[] = [];
      for (const m of mvps) {
        const mReward = await computeReward(m.userId, bonus, 'hunmin', true);
        const mvpRelicFx = await getRelicEffectsDetailed(m.userId, ['hunmin_bonus', 'all_bonus', 'combo_bonus']);
        const mvpRelicPct = mvpRelicFx.effects.hunminBonus + mvpRelicFx.effects.allBonus + mvpRelicFx.effects.comboBonus;
        const mvpRelicBonus = mvpRelicPct > 0 ? Math.round(mReward.finalReward * mvpRelicPct / 100) : 0;
        rewardHunminWord(roomId, m.userId, m.nickname, mReward.finalReward + mvpRelicBonus);
        if (mReward.regularComboTriggered) comboTriggers.push({ nickname: m.nickname });
      }
      endHunminSession(roomId);
      return res.json(hunminEndResponse(hunmin, comboTriggers, userId));
    }
    return res.json(multiOutput([mentionText(`🔮 {{#mentions.u}} 진행 중인 게임이 없어요.`), card({ title: "🔮 진행 중인 게임이 없어요." })], { u: { type: "botUserKey", id: userId } }));
  }

  // ── 지금시작 (시작 버튼) ──
  if (utterance === "지금시작" || utterance === "시작") {
    const hunmin = getHunminSession(roomId);
    // 훈민정음 진행 중에 "시작" 입력은 단어 제출로 처리 (초성이 ㅅㅈ 인 경우 등)
    if (!(utterance === "시작" && hunmin?.phase === "playing")) {
      if (!hunmin) {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음이 없어요`),
            card({
              title: "이미 종료됐거나 등록 시간이 초과됐어요.",
              description: "",
              buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      if (hunmin.phase !== "registration") {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 이미 게임이 진행 중이에요`),
            card({
              title: "🔮 이미 게임이 진행 중이에요",
              description: `현재 참여자 : ${hunmin.participants.size}명`,
              buttons: [STOP_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      const isSoloStart = hunmin.participants.size === 1;
      if (hunmin.registrationTimer) clearTimeout(hunmin.registrationTimer);
      transitionToPlaying(hunmin);
      return res.json(multiOutput(
        [
          mentionText(`🎮 {{#mentions.u}} 님이 게임을 시작했어요!`),
          card({
            title: `🎮 훈민정음 시작!`,
            description: [
              `초성 : ${hunmin.chosung}`,
              `참여자 : ${hunmin.participants.size}명`,
              `⏱ 제한시간: 45초`,
              ...(isSoloStart ? [`📢 MVP 보너스 없음`] : []),
            ].join("\n"),
            buttons: [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // "시작" + playing → 아래 단어 제출 핸들러로 이동
  }

  const session = getHunminSession(roomId);

  if (!session) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음 게임이 없어요!`),
        card({
          title: "🔮 진행 중인 훈민정음 게임이 없어요!",
          description: "먼저 게임을 시작해주세요.",
          buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  return await handleHunminSubmit(session, roomId, userId, nickname, utterance, res);
});

// ──────────────────────────────────────────────
// 랭킹 조회
// POST /api/kakao/ranking
// ──────────────────────────────────────────────
router.post("/ranking", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  return res.json(await buildRankingResponse(roomId, userId, nickname));
});

// ──────────────────────────────────────────────
// 게임 종료
// POST /api/kakao/end
// ──────────────────────────────────────────────
router.post("/end", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // 📢 카카오 블록 오라우팅 방지: 명시적 종료 키워드가 아니면 게임을 종료하지 않음
  // (사용자가 게임 중 정답이나 다른 명령어를 입력했는데 카카오 "종료" 블록이
  //  잘못 매칭해 /end로 라우팅되어 게임이 갑자기 끝나는 문제 방지)
  const STOP_WORDS = new Set(["", "종료", "그만", "끝"]);
  if (!STOP_WORDS.has(utterance)) {
    // 훈민정음 진행 중 — 단어 제출로 처리하지 않고 현재 게임 상태만 안내
    // (명령어/오타가 훈민정음 단어로 제출되어버리는 부작용 방지)
    const hunminS = getHunminSession(roomId);
    if (hunminS) {
      return res.json(multiOutput(
        [
          mentionText(`🎮 {{#mentions.u}} 훈민정음 진행 중`),
          card({
            title: "🎮 훈민정음 진행 중",
            description: [
              `초성 : ${hunminS.chosung}`,
              `⏱ 남은 시간 : ${getRemainingPlaySec(hunminS)}초`,
              ``,
              `"단어 제출" 버튼을 눌러 @초능력자 를 멘션 후 단어를 입력하세요!`,
            ].join("\n"),
            buttons: [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 초성퀴즈 진행 중
    const sess = getSession(roomId);
    if (sess && !sess.ended) {
      const q = getCurrentQuiz(sess);
      if (q) {
        if (checkAnswer(q, utterance)) {
          // 정답 처리 (오라우팅된 정답이 있을 수 있음 - 딘딘 케이스 등)
          if (sess.lastCreditedQuizId === q.id) {
            return res.json(multiOutput([mentionText(`✅ {{#mentions.u}} 이미 처리된 정답이에요.`), card({ title: "✅ 이미 처리된 정답이에요.", description: "다음 문제를 풀어볼까요?" })], { u: { type: "botUserKey", id: userId } }));
          }
          sess.lastCreditedQuizId = q.id;
          sess.lastActivityAt = new Date();
          resetSessionTimer(roomId);
          const basePts = sess.currentPts;
          const reward = await computeReward(userId, basePts, 'chosung', true);
          // 유물 효과 적용
          const endRelicFx = await getRelicEffectsDetailed(userId, ['chosung_bonus', 'all_bonus', 'combo_bonus']);
          const endRelicPct = endRelicFx.effects.chosungBonus + endRelicFx.effects.allBonus + endRelicFx.effects.comboBonus;
          const endRelicBonus = endRelicPct > 0 ? Math.round(reward.finalReward * endRelicPct / 100) : 0;
          const pts = reward.finalReward + endRelicBonus;
          sess.correct += 1;
          sess.total += 1;
          recordScore(userId, nickname, pts, 'earn_chosung');
          recordRoomScore(roomId, userId, nickname, pts);
          const cumTotal = getUserScore(userId)?.score ?? pts;
          const snapC = sess.correct; const snapT = sess.total;
          suspendSession(roomId);
          const endResp = correctResponse(roomId, userId, pts, cumTotal, snapC, snapT, { comboTriggered: reward.regularComboTriggered, comboPct: reward.comboPct, basePts });
          const endRelicInfo = relicBreakdownLine(endRelicFx.mainPct, endRelicFx.storagePct);
          if (endRelicInfo && endResp?.template?.outputs?.[0]) {
            const out = endResp.template.outputs[0] as Record<string, { text: string }>;
            if (out.simpleText) out.simpleText.text += `\n${endRelicInfo}`;
          }
          return res.json(endResp);
        }
        // 오답이거나 명령어 오라우팅 — 페널티 없이 현재 문제 상태만 안내
        // (출첵/프로필 등 명령어가 오라우팅돼도 점수 차감/세션 종료 없음)
        const hint = sess.revealedKoreanIndices.length > 0
          ? buildHintDisplayRandom(q.answer, new Set(sess.revealedKoreanIndices))
          : undefined;
        const remaining = getRemainingTime(sess.questionStartedAt);
        const maxHints = calcMaxHints(q.answer);
        const hintsLeft = sess.hintsUsed < maxHints;
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 초성퀴즈 진행 중`),
            card({
              title: `🔮 문제 : ${hint ?? q.chosung}`,
              description: `남은 시간 : ${remaining}`,
              buttons: hintsLeft ? [HINT_BTN, MENTION_BTN] : [NEXT_BTN, MENTION_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
    }

    // 진행 중인 게임 없음 — 게임을 끝내지 않고 메뉴 안내
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 안녕하세요 초능력자예요!`),
        card({
          description: "🔮 안녕하세요 초능력자예요!\n게임을 통해 능력자로 발돋움해요.",
          buttons: [
            { action: "message", label: "게임하기", messageText: "@초능력자 게임하기" },
            { action: "message", label: "내 유물",  messageText: "@초능력자 내유물" },
            { action: "guide",   label: "도움말" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
      MENU_REPLIES,
    ));
  }

  // 훈민정음 세션 종료
  const hunmin = getHunminSession(roomId);
  if (hunmin) {
    const mvps = calcMvps(hunmin.roundScores, hunmin.participants);
    const bonus = calcMvpBonus(hunmin, mvps);
    const comboTriggers: { nickname: string }[] = [];
    for (const m of mvps) {
      const mReward = await computeReward(m.userId, bonus, 'hunmin', true);
      const mvpRelicFx = await getRelicEffectsDetailed(m.userId, ['hunmin_bonus', 'all_bonus', 'combo_bonus']);
      const mvpRelicPct = mvpRelicFx.effects.hunminBonus + mvpRelicFx.effects.allBonus + mvpRelicFx.effects.comboBonus;
      const mvpRelicBonus = mvpRelicPct > 0 ? Math.round(mReward.finalReward * mvpRelicPct / 100) : 0;
      rewardHunminWord(roomId, m.userId, m.nickname, mReward.finalReward + mvpRelicBonus);
      if (mReward.regularComboTriggered) comboTriggers.push({ nickname: m.nickname });
    }
    endHunminSession(roomId);
    return res.json(hunminEndResponse(hunmin, comboTriggers, userId));
  }

  // 초성퀴즈 세션 종료
  const session = getSession(roomId);
  if (!session || session.ended) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 진행 중인 게임이 없어요!`),
        card({
          title: "🔮 진행 중인 게임이 없어요!",
          description: "아래에서 게임을 선택해주세요",
          buttons: [
            { action: "message", label: "게임하기", messageText: "@초능력자 초성퀴즈" },
            { action: "message", label: "내유물",   messageText: "@초능력자 내유물" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  const quiz = session.mode === "chosung" ? getCurrentQuiz(session) : undefined;
  suspendSession(roomId);
  return res.json(endCard(session, quiz?.answer, userId, roomId));
});

// ──────────────────────────────────────────────
// 폴백 — 게임 중이면 자동으로 정답 처리
// POST /api/kakao/fallback
// ──────────────────────────────────────────────
const EVAL_USER_IDS = new Set([
  "ff26b9405734fbc4958a4b3f1e47fa8eef4f2b1b201aba6572507f2e8405b00fe5", // 운영 채널
  "ffcd5de0d94f2ed666fa7b44ad3cecda934f2b1b201aba6572507f2e8405b00fe5", // 개발 채널
]);

router.post("/fallback", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  // 상호작용 시 자동 등록 (DB 없으면 50P 신규 생성)
  await ensureUserInRankingBoard(userId, nickname, roomId);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";
  // 방 최초 방문 기록 (이벤트참여 유효성 검사용)
  void pool.query(
    `INSERT INTO room_first_seen (room_id, first_seen_at) VALUES ($1, NOW()) ON CONFLICT DO NOTHING`,
    [roomId],
  );
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // 자모포기 — 최우선 처리 (어떤 게임 세션보다 앞)
  if (utterance === "자모포기" || utterance === "자모 포기" || utterance === "포기") {
    const jamoSess = getJamoSession(roomId);
    if (!jamoSess) {
      return res.json(multiOutput(
        [
          mentionText(`🔤 {{#mentions.u}} ❌ 진행 중인 자모연성이 없어요.`),
          card({
            title: "자모연성을 시작해주세요!",
            description: "",
            buttons: [
              { action: "message", label: "프로필",   messageText: "@초능력자 프로필" },
              { action: "message", label: "자모연성", messageText: "@초능력자 자모연성" },
            ],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const diff = jamoSess.difficulty;
    clearJamoSession(roomId);
    jamoJustFinished.set(roomId, { difficulty: diff, at: Date.now() });
    return res.json(multiOutput(
      [
        mentionText(`🔤 {{#mentions.u}} 자모연성 포기!`),
        card({
          title: "🔤 자모연성 포기",
          description: [
            `정답은 「${jamoSess.answer}」 이었어요.`,
            `다시 도전해볼까요?`,
          ].join("\n"),
          buttons: [JAMO_NEXT_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 타자포기 — 진행 중인 타자게임 포기
  if (utterance === "타자포기" || utterance === "타자 포기") {
    const typSess = getTypingSession(userId);
    if (!typSess) {
      return res.json(multiOutput(
        [
          mentionText(`⌨️ {{#mentions.u}} 진행 중인 타자게임이 없어요.`),
          card({
            title: "⌨️ 타자게임 없음",
            description: "타자게임을 시작하려면 \"타자게임\"을 입력해주세요.",
            buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    clearTypingSession(userId);
    return res.json(multiOutput(
      [
        mentionText(`⌨️ {{#mentions.u}} 타자게임 포기`),
        card({
          title: "⌨️ 타자게임 포기",
          description: [
            `문장: 「${typSess.sentence}」`,
            `다시 도전해보세요!`,
          ].join("\n"),
          buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 이벤트참여: 오늘 초대된 방인지 체크 후 초대 로그 등록 ──────────────────
  if (utterance === "이벤트참여") {
    // 혼자 있는 방 체크: 그룹 방은 botGroupKey가 존재, 1:1 봇 채팅은 없음
    const isGroupRoom = !!req.body?.userRequest?.chat?.properties?.botGroupKey;
    if (!isGroupRoom) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} ❌ 혼자 있는 방에서는 참여할 수 없어요!`),
          card({
            description: `최소 2명 이상의 방에서 이벤트 참여가 가능해요. 💙`,
            buttons: [{ action: 'invite', label: '다른 방에 초대하기' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    // INSERT ON CONFLICT DO NOTHING RETURNING: 방금 생성됐으면 오늘 새 방
    const fsInsert = await pool.query<{ first_seen_at: Date }>(
      `INSERT INTO room_first_seen (room_id, first_seen_at) VALUES ($1, NOW())
       ON CONFLICT (room_id) DO NOTHING RETURNING first_seen_at`,
      [roomId],
    );
    let isNewRoom = (fsInsert.rowCount ?? 0) > 0;
    if (!isNewRoom) {
      const fsSelect = await pool.query<{ first_seen_at: Date }>(
        `SELECT first_seen_at FROM room_first_seen WHERE room_id = $1`,
        [roomId],
      );
      const existingDate = fsSelect.rows[0]?.first_seen_at
        ? new Date(new Date(fsSelect.rows[0].first_seen_at).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;
      isNewRoom = existingDate === todayKST;
    }

    if (!isNewRoom) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} ❌ 이 방은 오늘 초대된 방이 아니에요!`),
          card({ description: `오늘 새로 초능력자를 초대한 방에서만\n이벤트 참여가 가능해요. 💙` }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const cntRes2 = await pool.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1 AND activity_date = $2::date`,
      [userId, todayKST],
    );
    const currentCount2 = parseInt(cntRes2.rows[0].c, 10);

    if (currentCount2 >= 5) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 오늘은 이미 5곳 모두 초대 완료했어요! 🎉`),
          card({
            description: `💙💙💙💙💙 달성!\n\n아래 버튼을 클릭하여 보상을 받아가세요!`,
            buttons: [{ action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const insertRes2 = await pool.query(
      `INSERT INTO event_invite_log (user_id, room_id, activity_date) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`,
      [userId, roomId, todayKST],
    );

    if ((insertRes2.rowCount ?? 0) === 0) {
      const hearts2 = '💙'.repeat(currentCount2) + '🤍'.repeat(5 - currentCount2);
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 이 방은 이미 참여 완료했어요!`),
          card({
            description: `참여 횟수 : ${hearts2}\n\n아래 버튼을 클릭하여 보상을 받아가세요!`,
            buttons: [
              { action: 'invite', label: '초대하기' },
              { action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' },
            ],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    const newCount2 = currentCount2 + 1;
    const hearts2   = '💙'.repeat(newCount2) + '🤍'.repeat(5 - newCount2);
    const tailMsg2  = '\n\n아래 버튼을 클릭하여 보상을 받아가세요!';

    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.u}} 초능력자의 기운이 스며들고 있어요! ⚡`),
        card({
          description: `이벤트 참여 완료!\n참여 횟수 : ${hearts2}${tailMsg2}`,
          buttons: [
            { action: 'invite', label: '초대하기' },
            { action: 'message', label: '에너지흡수', messageText: '@초능력자 에너지흡수' },
          ],
        }),
      ],
      { u: { type: 'botUserKey', id: userId } },
    ));
  }

  // ── 에너지흡수 이벤트 명령어 ────────────────────────────────────────────
  if (utterance === "에너지흡수") {
    // 서버 총 이용자 수 & 유저 초대 내역 & 미수령 방 목록 동시 조회
    const [userCountRes, totalInvitedRes, unclaimedRes] = await Promise.all([
      pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM users`),
      pool.query<{ c: string }>(
        `SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1`,
        [userId],
      ),
      pool.query<{ room_id: string; activity_date: string }>(
        `SELECT eil.room_id, eil.activity_date::text
         FROM event_invite_log eil
         WHERE eil.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM event_room_claimed erc
           WHERE erc.room_id = eil.room_id AND erc.activity_date = eil.activity_date
         )`,
        [userId],
      ),
    ]);
    const userCount      = parseInt(userCountRes.rows[0].c, 10);
    const totalInvited   = parseInt(totalInvitedRes.rows[0].c, 10);
    const displayN       = Math.min(totalInvited, 5);
    const hearts         = '💙'.repeat(displayN) + '🤍'.repeat(5 - displayN);
    const unclaimedRooms = unclaimedRes.rows;

    if (totalInvited === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 받을 보상이 없어요! 💙`),
          card({ description: `참여 횟수 : 🤍🤍🤍🤍🤍\n\n초능력자를 새 방에 초대하고\n@초능력자 이벤트참여 를 눌러보세요!` }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    if (unclaimedRooms.length === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 초대한 방의 보상이 이미 모두 수령됐어요!`),
          card({
            description: `참여 횟수 : ${hearts}\n\n다른 사람이 먼저 받아갔어요.\n새 방에 초능력자를 초대해보세요! 💙`,
            buttons: [{ action: 'message', label: '이벤트참여', messageText: '@초능력자 이벤트참여' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    // 방별 선착순 claim 시도
    let available = 0;
    for (const { room_id, activity_date } of unclaimedRooms) {
      const claimRes = await pool.query(
        `INSERT INTO event_room_claimed (room_id, activity_date, user_id) VALUES ($1, $2::date, $3) ON CONFLICT DO NOTHING`,
        [room_id, activity_date, userId],
      );
      if ((claimRes.rowCount ?? 0) > 0) available++;
    }

    if (available === 0) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 아쉽게도 다른 사람이 먼저 받아갔어요!`),
          card({
            description: `참여 횟수 : ${hearts}\n\n새 방에 초능력자를 초대해서 다시 도전해보세요! 💙`,
            buttons: [{ action: 'message', label: '이벤트참여', messageText: '@초능력자 이벤트참여' }],
          }),
        ],
        { u: { type: 'botUserKey', id: userId } },
      ));
    }

    // 보상 지급: 방 1개당 서버 총 이용자 수 × 1P
    const pointReward = userCount * available;
    refundPoints(userId, nickname, pointReward);

    const relicLines: string[] = [];
    for (let i = 0; i < available; i++) {
      const relic   = await createEventRelic(userId, 2);
      const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === relic.typeId);
      const name    = typeDef?.gradeNames[1] ?? 'C등급 유물';
      relicLines.push(`  🟢 ${name} (+0 Lv.1)`);
    }

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO event_claim_log (user_id, activity_date, claimed_count) VALUES ($1, $2::date, $3)
       ON CONFLICT (user_id, activity_date) DO UPDATE SET claimed_count = event_claim_log.claimed_count + EXCLUDED.claimed_count`,
      [userId, todayKST, available],
    );

    return res.json(multiOutput(
      [
        mentionText(
          `{{#mentions.u}} 능력자의 에너지 증정 완료! 🌀\n\n` +
          `참여 횟수 : ${hearts}\n\n` +
          `현재 ${userCount.toLocaleString()}명의 능력자들이 함께해요!\n` +
          `더 많은 방에 초능력자를 초대할수록 많은 포인트를 받을 수 있어요 💙`,
        ),
        card({
          description:
            `• 포인트 : +${pointReward.toLocaleString()}P\n` +
            `• 유물 : C등급 랜덤 유물 ×${available}\n` +
            relicLines.join('\n'),
          buttons: [
            { action: 'message', label: '유물보관함', messageText: '@초능력자 유물보관함' },
            { action: 'message', label: '프로필', messageText: '@초능력자 프로필' },
          ],
        }),
      ],
      { u: { type: 'botUserKey', id: userId } },
    ));
  }

  // 타자게임 진행 중 — 메시지를 답변으로 처리
  {
    const typSess = getTypingSession(userId);
    if (typSess && utterance !== "타자게임") {
      try {
        const result = calcTypingResult(typSess, utterance);
        clearTypingSession(userId);

        const fmt = (n: number) => n.toLocaleString();
        const elapsedStr = result.elapsedSec >= 60
          ? `${Math.floor(result.elapsedSec / 60)}분 ${result.elapsedSec % 60}초`
          : `${result.elapsedSec}초`;

        if (result.failed) {
          return res.json(multiOutput(
            [
              mentionText(`⌨️ {{#mentions.u}} 정확도 ${result.accuracy}% — 아쉬워요!`),
              card({
                title: "⌨️ 타자게임 결과",
                description: [
                  `문장: 「${typSess.sentence}」`,
                  ``,
                  `정확도: ${result.accuracy}%`,
                  `소요 시간: ${elapsedStr}`,
                  `타속: ${fmt(result.타수)}타/분`,
                  ``,
                  ...result.bonuses,
                  ``,
                  `90% 이상 정확도로 다시 도전해보세요!`,
                ].join("\n"),
                buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
              }),
            ],
            { u: { type: "botUserKey", id: userId } },
          ));
        }

        // 유물 보너스
        const typingRelicFx  = await getRelicEffectsDetailed(userId, ['all_bonus', 'combo_bonus']);
        const typingRelicPct = typingRelicFx.effects.allBonus + typingRelicFx.effects.comboBonus;
        const typingRelicBonus = typingRelicPct > 0 ? Math.round(result.pts * typingRelicPct / 100) : 0;

        // 콤보 보너스
        const typingComboTriggered = recordWin(userId, 'jamo');
        const typingComboActive    = isComboActive(userId);
        const baseBeforeCombo      = result.pts + typingRelicBonus;
        const typingComboBonusPt   = typingComboActive ? Math.round(baseBeforeCombo * 0.2) : 0;
        const finalPts             = baseBeforeCombo + typingComboBonusPt;

        const bonusLines = [...result.bonuses];
        if (typingRelicBonus > 0) bonusLines.splice(bonusLines.length - 2, 0, `🏛️ 유물 보너스: +${fmt(typingRelicBonus)}P`);
        if (typingComboBonusPt > 0) bonusLines.splice(bonusLines.length - 2, 0, `🔥 콤보 보너스: +${fmt(typingComboBonusPt)}P (+20%)`);
        bonusLines[bonusLines.length - 1] = `합계: +${fmt(finalPts)}P`;

        recordScore(userId, nickname, finalPts);
        const cumTotal = getUserScore(userId)?.score ?? finalPts;

        const comboLine = typingComboTriggered
          ? `\n🔥 콤보 발동! 60초간 +20%`
          : typingComboActive
          ? `\n🔥 콤보 진행 중 (${getComboRemainingSeconds(userId)}초 남음)`
          : '';

        const typingRelicInfo = relicBreakdownLine(typingRelicFx.mainPct, typingRelicFx.storagePct);
        return res.json(multiOutput(
          [
            mentionText(
              `⌨️ {{#mentions.u}} 정확도 ${result.accuracy}% · ${fmt(result.타수)}타/분 · +${fmt(finalPts)}P${comboLine}\n총 포인트: ${scoreDisplay(cumTotal)}`
              + (typingRelicInfo ? `\n${typingRelicInfo}` : ''),
            ),
            card({
              title: "⌨️ 타자게임 결과",
              description: [
                `문장: 「${typSess.sentence}」`,
                ``,
                `정확도: ${result.accuracy}%`,
                `소요 시간: ${elapsedStr}`,
                `타속: ${fmt(result.타수)}타/분`,
                ``,
                ...bonusLines,
              ].join("\n"),
              buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      } catch (err) {
        clearTypingSession(userId);
        logger.error({ err }, "typing game result error");
        return res.json(multiOutput(
          [
            mentionText(`⌨️ {{#mentions.u}} 타자게임 오류`),
            card({
              title: "⌨️ 타자게임 오류",
              description: "결과 처리 중 오류가 발생했어요. 다시 시도해주세요.",
              buttons: [{ action: "message", label: "타자게임", messageText: "@초능력자 타자게임" }],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
    }
  }

  // ── 닉네임 변경 대기 중 처리 (멘션 입력 폴백 경유 시) ──────────────
  if (pendingNickChange.has(userId)) {
    if (utterance === "취소") {
      pendingNickChange.delete(userId);
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 취소`),
          card({ title: "✏️ 닉네임 변경 취소", description: "닉네임 변경을 취소했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const newNick = utterance;
    pendingNickChange.delete(userId);

    // ① 현재 닉네임과 동일한지 확인
    const myScorePre = getUserScore(userId);
    if (myScorePre && myScorePre.nickname === newNick) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: "현재 사용 중인 닉네임이에요.\n다른 닉네임을 입력해주세요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // ② 닉네임 필터 검사 (차단 시 포인트 소모 없음, 로그 저장)
    const filterResult = checkNicknameWithLog(userId, newNick);
    if (!filterResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: filterResult.reason ?? "사용할 수 없는 닉네임이에요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // ③ 닉네임 변경 (중복 체크 등 포함)
    const changeResult = changeNickname(userId, newNick);
    if (!changeResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 실패`),
          card({ title: "✏️ 닉네임 변경 실패", description: changeResult.errorMsg ?? "알 수 없는 오류가 발생했어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    return res.json(multiOutput(
      [
        mentionText(`✅ {{#mentions.u}} 닉네임 변경 완료!`),
        card({ title: "✅ 닉네임 변경 완료", description: `닉네임이 "${newNick}"으로 변경됐어요!` }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 선물 명령어 — 멘션 ID 없으면 즉시 차단, 게임 중에는 사용 불가
  if (utterance === "선물" || utterance.startsWith("선물 ")) {
    // 3단계 멘션 추출 (handleGift와 동일)
    const fbEntities: any[] = req.body?.userRequest?.entities ?? [];
    const fbMentEnt = fbEntities.filter((e: any) => e.type === "mention").slice(-1)[0];
    const fbExtraM: any[] = req.body?.userRequest?.extra?.mentions ?? req.body?.extra?.mentions ?? [];
    const fbExtraEnt = fbExtraM.find((m: any) => (m.id ?? m.userId ?? m.value) && (m.id ?? m.userId ?? m.value) !== userId);
    const fbParams: Record<string, string> = req.body?.action?.params ?? {};
    let fbSysMentId: string | undefined;
    for (const [k, v] of Object.entries(fbParams)) {
      if (k.startsWith("sys_user_mention")) {
        try {
          const p = typeof v === "string" ? JSON.parse(v) : v;
          const c: string | undefined = p?.botUserKey ?? p?.appUserId;
          if (c && c !== userId) { fbSysMentId = c; break; }
        } catch { /* ignore */ }
      }
    }
    const fbExtractedId: string | undefined =
      fbSysMentId ||
      fbMentEnt?.value || fbMentEnt?.userId || fbMentEnt?.id ||
      fbExtraEnt?.id || fbExtraEnt?.userId || fbExtraEnt?.value;

    if (!fbExtractedId) {
      return res.json(multiOutput(
        [mentionText("{{#mentions.me}} 선물할 대상이 없어요")],
        { me: { type: "botUserKey", id: userId } }
      ));
    }
    return res.json(multiOutput(
      [
        mentionText(`📢 {{#mentions.u}} 게임 진행 중`),
        card({
          title: "📢 게임 진행 중",
          description: "선물은 게임이 끝난 후 이용해주세요!\n게임을 먼저 종료하려면 \"종료\"를 입력하세요.",
          buttons: [{ action: "message", label: "종료", messageText: "@초능력자 종료" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 관리 명령어 (관리자 전용) ──────────────────────────────────────────────
  if (EVAL_USER_IDS.has(userId) && (utterance === "관리 help" || utterance.startsWith("관리 "))) {
    const cmd = utterance.slice(3).trim(); // "관리 " 이후 부분

    // ── help ──────────────────────────────────────────────
    if (cmd === "help") {
      return res.json({ version: "2.0", template: { outputs: [plainText(
        "🔧 관리 명령어 목록\n\n" +
        "[통계/랭킹]\n" +
        "관리 cats              — 카테고리별 퀴즈 수\n" +
        "관리 stats             — 전체 통계 요약\n" +
        "관리 방문              — 웹사이트 방문 통계\n" +
        "관리 닉변이력 [n]      — 닉네임 변경 이력 (기본 최근 20건)\n" +
        "관리 top [n]           — 랭킹 상위 n명 (기본 10)\n" +
        "관리 user [닉]         — 유저 상세 정보\n" +
        "관리 add [닉] [n]      — 포인트 추가(+)/차감(-)\n" +
        "관리 닉변 [현재닉] [새닉] — 유저 닉네임 강제 변경\n" +
        "관리 sample [주제] [n] — 퀴즈 샘플 (기본 5개)\n" +
        "관리 sessions          — 현재 활성 세션 목록\n" +
        "관리 모니터링 [날짜]    — 일별 지표 상세 (날짜 생략 시 오늘)\n" +
        "관리 모니터링 요약      — 최근 14일 추이 한눈에 보기\n\n" +
        "[초성퀴즈 단어 관리]\n" +
        "관리 퀴즈 추가 [주제] [정답] — 퀴즈 추가\n" +
        "관리 퀴즈 삭제 [정답]        — 퀴즈 삭제\n" +
        "관리 퀴즈 검색 [검색어]      — 퀴즈 검색\n\n" +
        "[훈민정음 단어 관리]\n" +
        "관리 훈민 추가 [단어]        — 단어 추가\n" +
        "관리 훈민 삭제 [단어]        — 단어 삭제\n" +
        "관리 훈민 검색 [단어/초성]   — 단어 검색\n\n" +
        "[신형 유물 관리]\n" +
        "관리 유물 [닉]                             — 유물 목록 조회\n" +
        "관리 유물 [닉] [번호] 등급 [D/C/B/A/S/SS]  — 등급 변경\n" +
        "관리 유물 [닉] [번호] 강화 [0-20]           — 강화 변경\n" +
        "관리 유물 [닉] [번호] 레벨 [1-50]           — 레벨 변경\n" +
        "관리 유물 [닉] [시작~끝] 등급/강화/레벨 [값]  — 일괄 범위 변경\n\n" +
        "[이벤트 관리]\n" +
        "관리 이벤트 현황             — 전체 참여 현황 조회\n" +
        "관리 이벤트 [닉]             — 특정 유저 참여횟수 조회\n" +
        "관리 이벤트 [닉] [+n/-n]    — 참여횟수 조절 (추가/차감)\n\n" +
        "[통합 랭킹 배율]\n" +
        "관리 배율                    — 현재 A·B 배율 조회\n" +
        "관리 배율 [A] [B]            — 배율 실시간 변경 (예: 관리 배율 1400 15.6)\n\n" +
        "eval [코드]                  — 직접 코드 실행"
      )] } });
    }

    // ── cats: 카테고리별 퀴즈 수 + 평균 정답률 ──────────────
    if (cmd === "cats") {
      const cnt = getCategoryCountMap();
      const catRates = new Map<string, { attempts: number; corrects: number }>();
      for (const q of quizBank) {
        const r = catRates.get(q.category) ?? { attempts: 0, corrects: 0 };
        r.attempts += q.attemptCount;
        r.corrects += q.correctCount;
        catRates.set(q.category, r);
      }
      const lines = [
        `📊 카테고리별 퀴즈 수 (총 ${quizBank.length}개)\n`,
        ...getQuizCategories().map((c) => {
          const r = catRates.get(c) ?? { attempts: 0, corrects: 0 };
          const rateStr = r.attempts > 0 ? `${Math.round(r.corrects / r.attempts * 100)}%` : "-";
          return `${c} - ${cnt.get(c) ?? 0}개 / 정답률 ${rateStr}`;
        }),
      ];
      return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
    }

    // ── stats: 전체 통계 ─────────────────────────────────────
    if (cmd === "stats") {
      const cnt = getCategoryCountMap();
      const ranking = getRanking();
      const top = ranking[0];
      // KST 오늘 날짜
      const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const todayStart = `date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'`;
      // 병렬 DB 쿼리
      const [activeUsersRes, dailyActiveRes, upgradeStatsRes, gachaCountRes, visitRes] = await Promise.all([
        pool.query<{ c: string }>(
          `SELECT COUNT(DISTINCT user_id) AS c FROM game_events WHERE event_date = $1`,
          [todayKST],
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(DISTINCT user_id) AS c FROM kakao_daily_active WHERE activity_date = $1::date`,
          [todayKST],
        ),
        pool.query<{ tries: string; successes: string }>(
          `SELECT COALESCE(SUM(total_upgrade_try),0) AS tries,
                  COALESCE(SUM(total_upgrade_success),0) AS successes
           FROM artifact_stats`,
        ),
        pool.query<{ c: string }>(
          `SELECT COUNT(*) AS c FROM game_events WHERE event_type='gacha' AND event_date=$1`,
          [todayKST],
        ),
        pool.query<{ total: string; today: string }>(
          `SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE visited_at >= ${todayStart}) AS today
           FROM site_visits`,
        ).catch(() => ({ rows: [{ total: '0', today: '0' }] })),
      ]);
      const todayActiveUsers  = parseInt(activeUsersRes.rows[0].c, 10);
      const todayDailyActive  = parseInt(dailyActiveRes.rows[0].c, 10);
      const upgradeTries    = parseInt(upgradeStatsRes.rows[0].tries, 10);
      const upgradeSucc     = parseInt(upgradeStatsRes.rows[0].successes, 10);
      const upgradeRate     = upgradeTries > 0 ? `${Math.round(upgradeSucc / upgradeTries * 100)}%` : "-";
      const todayGacha      = parseInt(gachaCountRes.rows[0].c, 10);
      const totalVisits     = parseInt(visitRes.rows[0]?.total ?? '0', 10);
      const todayVisits     = parseInt(visitRes.rows[0]?.today ?? '0', 10);
      // 랭킹보드 집계
      const totalCorrect = ranking.reduce((s, u) => s + u.correct, 0);
      const totalTotal   = ranking.reduce((s, u) => s + u.total, 0);
      const totalPts     = ranking.reduce((s, u) => s + u.score, 0);
      const overallRate  = totalTotal > 0 ? `${Math.round(totalCorrect / totalTotal * 100)}%` : "-";
      const text = [
        `📈 초능력자 서버 통계 (${todayKST})\n`,
        `[유저]`,
        `전체 유저: ${ranking.length}명 / 오늘 활성: ${todayActiveUsers}명 / 오늘 활동: ${todayDailyActive}명`,
        ``,
        `[웹사이트 방문]`,
        `오늘 방문: ${fmt(todayVisits)}회 / 누적: ${fmt(totalVisits)}회`,
        ``,
        `[퀴즈]`,
        `문제: ${quizBank.length}개 / ${cnt.size}개 주제`,
        `전체 정답: ${fmt(totalCorrect)} / 전체 시도: ${fmt(totalTotal)} / 정답률: ${overallRate}`,
        ``,
        `[포인트]`,
        `총 포인트 유통량: ${fmt(totalPts)}P`,
        `1위: ${top ? `${top.nickname} (${fmt(top.score)}P)` : "없음"}`,
        ``,
        `[유물]`,
        `유물 강화 성공률: ${upgradeRate} (${fmt(upgradeSucc)}/${fmt(upgradeTries)})`,
        `오늘 유물 뽑기: ${todayGacha}회`,
        ``,
        `[세션]`,
        `활성 초성퀴즈: ${getAllSessions().length}개 방`,
        `활성 훈민정음: ${getAllHunminSessions().length}개 방`,
      ].join("\n");
      return res.json({ version: "2.0", template: { outputs: [plainText(text)] } });
    }

    // ── 방문: 웹사이트 방문 통계 ────────────────────────────
    if (cmd === "방문") {
      const todayStart = `date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'`;
      const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [visitRes, activeRes] = await Promise.allSettled([
        pool.query<{ total: string; today: string }>(`
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE visited_at >= ${todayStart}) AS today
          FROM site_visits
        `),
        pool.query<{ c: string }>(`
          SELECT COUNT(DISTINCT user_id) AS c
          FROM artifact_point_log
          WHERE created_at >= ${todayStart}
        `),
      ]);
      const totalVisits    = visitRes.status === 'fulfilled' ? parseInt(visitRes.value.rows[0]?.total ?? '0', 10) : 0;
      const todayVisits    = visitRes.status === 'fulfilled' ? parseInt(visitRes.value.rows[0]?.today ?? '0', 10) : 0;
      const todayActUsers  = activeRes.status === 'fulfilled' ? parseInt(activeRes.value.rows[0]?.c ?? '0', 10) : 0;
      const text = [
        `🌐 웹사이트 방문 통계 (${todayKST})\n`,
        `오늘 방문: ${fmt(todayVisits)}회`,
        `누적 방문: ${fmt(totalVisits)}회`,
        `오늘 봇 활동 유저: ${todayActUsers}명 (포인트 획득 기준)`,
      ].join("\n");
      return res.json({ version: "2.0", template: { outputs: [plainText(text)] } });
    }

    // ── 닉변이력: 닉네임 변경 이력 ──────────────────────────
    if (cmd === "닉변이력" || cmd.startsWith("닉변이력 ")) {
      const limit = parseInt(cmd.split(" ")[1] ?? "20", 10) || 20;
      const [totalRes, listRes] = await Promise.all([
        pool.query<{ unique_users: string; total_changes: string }>(`
          SELECT COUNT(DISTINCT user_id) AS unique_users, COUNT(*) AS total_changes
          FROM nickname_change_log
        `),
        pool.query<{ user_id: string; old_nickname: string; new_nickname: string; changed_at: string }>(`
          SELECT n.user_id, n.old_nickname, n.new_nickname,
                 to_char(n.changed_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI') AS changed_at
          FROM nickname_change_log n
          ORDER BY n.changed_at DESC
          LIMIT $1
        `, [limit]),
      ]);
      const uniqueUsers = parseInt(totalRes.rows[0]?.unique_users ?? "0", 10);
      const totalChanges = parseInt(totalRes.rows[0]?.total_changes ?? "0", 10);
      const lines = [
        `📝 닉네임 변경 이력\n`,
        `총 ${uniqueUsers}명이 총 ${totalChanges}회 변경\n`,
        `── 최근 ${limit}건 ──`,
        ...listRes.rows.map((r, i) =>
          `${i + 1}. [${r.changed_at}] ${r.old_nickname} → ${r.new_nickname}`
        ),
      ];
      return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
    }

    // ── top [n]: 랭킹 상위 n명 ──────────────────────────────
    if (cmd.startsWith("top")) {
      const n = parseInt(cmd.slice(3).trim()) || 10;
      const ranking = getRanking().slice(0, n);
      if (ranking.length === 0) {
        return res.json({ version: "2.0", template: { outputs: [plainText("랭킹 데이터 없음")] } });
      }
      const lines = [
        `🏆 랭킹 상위 ${n}명\n`,
        ...ranking.map((u, i) => `[${i + 1}위] ${u.nickname} — ${fmt(u.score)}P`),
      ];
      return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
    }

    // ── user [닉]: 유저 상세 정보 ────────────────────────────
    if (cmd.startsWith("user ")) {
      const nick = cmd.slice(5).trim();
      const found = getRanking().find((u) => u.nickname === nick || u.nickname.includes(nick));
      if (!found) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 유저 없음: ${nick}`)] } });
      }
      const rank = getRanking().findIndex((u) => u.userId === found.userId) + 1;
      const spRanking2 = getSpRanking();
      const spRankIdx = spRanking2.findIndex(e => e.userId === found.userId);
      const spRankStr = spBaseLoaded()
        ? (spRankIdx >= 0 ? `${spRankIdx + 1}위` : "순위 없음")
        : `집계 중 (포인트 ${rank}위)`;
      const text = [
        `👤 ${found.nickname}\n`,
        `포인트: ${fmt(found.score)}P`,
        `초능력자 순위: ${spRankStr}`,
        `포인트 순위: ${rank}위`,
        `총 맞힘: ${found.correct}문제 / ${found.total}문제`,
        `정답률: ${found.total > 0 ? Math.round(found.correct / found.total * 100) : 0}%`,
        `userId: ${found.userId.slice(0, 16)}...`,
      ].join("\n");
      return res.json({ version: "2.0", template: { outputs: [plainText(text)] } });
    }

    // ── add [닉] [n]: 포인트 추가/차감 ────────────────────────
    if (cmd.startsWith("add ")) {
      const parts = cmd.slice(4).trim().split(/\s+/);
      const nick = parts[0];
      const rawAmount = parts[1];
      if (!nick || !rawAmount) {
        return res.json({ version: "2.0", template: { outputs: [plainText("사용법: 관리 add [닉] [n]\n예) 관리 add 도혁 1000\n예) 관리 add 도혁 -500")] } });
      }
      const amount = parseInt(rawAmount.replace(/^\+/, ""));
      if (isNaN(amount)) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 숫자 오류: ${rawAmount}`)] } });
      }
      const found = getRanking().find((u) => u.nickname === nick || u.nickname.includes(nick));
      if (!found) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 유저 없음: ${nick}`)] } });
      }
      adminAddScore(found.userId, amount);
      const after = (found.score + amount);
      return res.json({ version: "2.0", template: { outputs: [plainText(
        `✅ ${found.nickname} 포인트 ${amount > 0 ? "+" : ""}${fmt(amount)}P\n→ 예상 잔액: ${fmt(after)}P`
      )] } });
    }

    // ── 닉변 [현재닉] [새닉]: 강제 닉네임 변경 ────────────────
    if (cmd.startsWith("닉변 ")) {
      const parts = cmd.slice(3).trim().split(/\s+/);
      if (parts.length < 2) {
        return res.json({ version: "2.0", template: { outputs: [plainText(
          "사용법: 관리 닉변 [현재닉] [새닉]\n예) 관리 닉변 능력자_abc123 새닉네임"
        )] } });
      }
      const fromNick = parts[0];
      const toNick   = parts.slice(1).join(" "); // 새 닉에 공백 포함 가능성 대비
      const result   = adminChangeNickname(fromNick, toNick);
      if (!result.ok) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ ${result.errorMsg}`)] } });
      }
      return res.json({ version: "2.0", template: { outputs: [plainText(
        `✅ 닉네임 변경 완료!\n${fromNick} → ${toNick}\nuserId: ${result.userId?.slice(0, 16)}...`
      )] } });
    }

    // ── sample [주제] [n]: 퀴즈 샘플 ───────────────────────
    if (cmd.startsWith("sample ")) {
      const rest = cmd.slice(7).trim();
      const lastSpace = rest.lastIndexOf(" ");
      let category = rest;
      let n = 5;
      if (lastSpace >= 0) {
        const maybeN = parseInt(rest.slice(lastSpace + 1));
        if (!isNaN(maybeN)) {
          category = rest.slice(0, lastSpace).trim();
          n = maybeN;
        }
      }
      const pool2 = quizBank.filter((q) => q.category === category);
      if (pool2.length === 0) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 주제 없음: ${category}`)] } });
      }
      const sample = pool2.slice(0, n);
      const lines = [
        `📝 [${category}] 샘플 ${sample.length}개\n`,
        ...sample.map((q) => `${q.chosung} → ${q.answer}`),
      ];
      return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
    }

    // ── sessions: 현재 활성 세션 ────────────────────────────
    if (cmd === "sessions") {
      const chosung     = getAllSessions();
      const hunmin      = getAllHunminSessions();
      const jamo        = getAllJamoSessions();
      const relicEvents = getRecentRelicEvents();

      const isEmpty = chosung.length === 0 && hunmin.length === 0 && jamo.length === 0 && relicEvents.length === 0;
      if (isEmpty) {
        return res.json({ version: "2.0", template: { outputs: [plainText("현재 활성 세션 없음")] } });
      }

      const lines: string[] = [`🎮 현재 활성 세션\n`];

      if (chosung.length > 0) {
        lines.push(`[초성퀴즈 ${chosung.length}개]`);
        chosung.forEach((s) => {
          lines.push(`  방${s.roomId.slice(-6)}: ${s.category ?? "랜덤"} | ${s.correct}/${s.total}문제`);
        });
      }

      if (hunmin.length > 0) {
        lines.push(`\n[훈민정음 ${hunmin.length}개]`);
        hunmin.forEach((h) => {
          lines.push(`  방${h.roomId.slice(-6)}: ${h.phase} | ${h.participants}명 | ${h.chosung}(${h.wordLen}자)`);
        });
      }

      if (jamo.length > 0) {
        lines.push(`\n[자모연성 ${jamo.length}개]`);
        const DIFF_LABEL: Record<string, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };
        jamo.forEach((s) => {
          const secLeft = Math.max(0, Math.ceil((s.expiresAt.getTime() - Date.now()) / 1000));
          lines.push(`  방${s.roomId.slice(-6)}: ${DIFF_LABEL[s.difficulty] ?? s.difficulty} | ${s.wordLen}글자 | ${secLeft}초 남음`);
        });
      }

      if (relicEvents.length > 0) {
        lines.push(`\n[유물 최근 30초]`);
        relicEvents.forEach((e) => {
          const secAgo = Math.round((Date.now() - e.at) / 1000);
          lines.push(`  ${e.nick} — ${e.action}: ${e.detail} (${secAgo}초 전)`);
        });
      }

      return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
    }

    // ── 퀴즈 관리 명령어 ────────────────────────────────
    if (cmd.startsWith("퀴즈 ")) {
      const quizCmd = cmd.slice(3).trim();

      // 퀴즈 추가: 관리 퀴즈 추가 [주제] [정답]
      if (quizCmd.startsWith("추가 ")) {
        const rest = quizCmd.slice(3).trim();
        const spaceIdx = rest.indexOf(" ");
        if (spaceIdx < 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(
            "사용법: 관리 퀴즈 추가 [주제] [정답]\n예) 관리 퀴즈 추가 가수 아이유"
          )] } });
        }
        const category = rest.slice(0, spaceIdx).trim();
        const answer   = rest.slice(spaceIdx + 1).trim();
        if (!category || !answer) {
          return res.json({ version: "2.0", template: { outputs: [plainText("주제와 정답을 모두 입력해주세요.")] } });
        }
        // 중복 체크
        const dup = quizBank.find((q) => q.answer === answer && q.category === category);
        if (dup) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`📢 이미 존재: [${category}] ${answer} (id=${dup.id})`)] } });
        }
        // 초성 계산
        const chosung = Array.from(answer).map(getChosung).join("");
        // DB INSERT
        const { rows: maxRow } = await pool.query<{ m: string }>(`SELECT COALESCE(MAX(id), 0) AS m FROM quizzes`);
        const newId = parseInt(maxRow[0].m, 10) + 1;
        await pool.query(
          `INSERT INTO quizzes (id, answer, chosung, category, alternate_answers) VALUES ($1, $2, $3, $4, $5)`,
          [newId, answer, chosung, category, "[]"]
        );
        // 메모리 캐시 반영
        quizBank.push({ id: newId, answer, chosung, category, alternateAnswers: [], attemptCount: 0, correctCount: 0 });
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 퀴즈 추가 완료!\n주제: ${category}\n정답: ${answer}\n초성: ${chosung}\nid: ${newId}\n총 퀴즈: ${quizBank.length}개`
        )] } });
      }

      // 퀴즈 삭제: 관리 퀴즈 삭제 [정답]
      if (quizCmd.startsWith("삭제 ")) {
        const answer = quizCmd.slice(3).trim();
        if (!answer) {
          return res.json({ version: "2.0", template: { outputs: [plainText(
            "사용법: 관리 퀴즈 삭제 [정답]\n예) 관리 퀴즈 삭제 아이유"
          )] } });
        }
        // 모든 일치 항목 찾기 (여러 주제에 같은 답이 있을 수 있음)
        const targets = quizBank.filter((q) => q.answer === answer);
        if (targets.length === 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 퀴즈 없음: "${answer}"`)] } });
        }
        const ids = targets.map((q) => q.id);
        await pool.query(`DELETE FROM quizzes WHERE id = ANY($1::int[])`, [ids]);
        // 메모리 캐시 반영
        const before = quizBank.length;
        quizBank.splice(0, quizBank.length, ...quizBank.filter((q) => q.answer !== answer));
        const removed = before - quizBank.length;
        const info = targets.map((q) => `  [${q.category}] ${q.answer} (id=${q.id})`).join("\n");
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 퀴즈 삭제 완료! (${removed}개)\n${info}\n총 퀴즈: ${quizBank.length}개`
        )] } });
      }

      // 퀴즈 검색: 관리 퀴즈 검색 [검색어]
      if (quizCmd.startsWith("검색 ")) {
        const keyword = quizCmd.slice(3).trim();
        const results = quizBank.filter((q) =>
          q.answer.includes(keyword) || q.chosung.includes(keyword) || q.category.includes(keyword)
        ).slice(0, 15);
        if (results.length === 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 검색 결과 없음: "${keyword}"`)] } });
        }
        const lines = [`🔍 "${keyword}" 검색 결과 (${results.length}개)\n`, ...results.map((q) => `[${q.category}] ${q.chosung} → ${q.answer} (정답률 ${fmtRate(q.attemptCount, q.correctCount)})`)];
        return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
      }

      return res.json({ version: "2.0", template: { outputs: [plainText(
        "퀴즈 관리 명령어:\n관리 퀴즈 추가 [주제] [정답]\n관리 퀴즈 삭제 [정답]\n관리 퀴즈 검색 [검색어]"
      )] } });
    }

    // ── 훈민정음 단어 관리 ──────────────────────────────
    if (cmd.startsWith("훈민 ")) {
      const hunCmd = cmd.slice(3).trim();

      // 훈민 추가: 관리 훈민 추가 [단어]
      if (hunCmd.startsWith("추가 ")) {
        const word = hunCmd.slice(3).trim();
        if (!word) {
          return res.json({ version: "2.0", template: { outputs: [plainText(
            "사용법: 관리 훈민 추가 [단어]\n예) 관리 훈민 추가 딘딘"
          )] } });
        }
        const chosung = Array.from(word).map(getChosung).join("");
        const wordLen = Array.from(word).length;
        const { rowCount } = await pool.query(
          `INSERT INTO dict_words (word, chosung, word_len) VALUES ($1, $2, $3) ON CONFLICT (word) DO NOTHING`,
          [word, chosung, wordLen]
        );
        const isNew = (rowCount ?? 0) > 0;
        return res.json({ version: "2.0", template: { outputs: [plainText(
          isNew
            ? `✅ 훈민정음 단어 추가!\n단어: ${word}\n초성: ${chosung}\n글자수: ${wordLen}자`
            : `📢 이미 존재하는 단어: "${word}"`
        )] } });
      }

      // 훈민 삭제: 관리 훈민 삭제 [단어]
      if (hunCmd.startsWith("삭제 ")) {
        const word = hunCmd.slice(3).trim();
        if (!word) {
          return res.json({ version: "2.0", template: { outputs: [plainText(
            "사용법: 관리 훈민 삭제 [단어]\n예) 관리 훈민 삭제 딘딘"
          )] } });
        }
        const { rowCount } = await pool.query(`DELETE FROM dict_words WHERE word = $1`, [word]);
        return res.json({ version: "2.0", template: { outputs: [plainText(
          (rowCount ?? 0) > 0
            ? `✅ 훈민정음 단어 삭제: "${word}"`
            : `❌ 단어 없음: "${word}"`
        )] } });
      }

      // 훈민 검색: 관리 훈민 검색 [단어 또는 초성]
      if (hunCmd.startsWith("검색 ")) {
        const keyword = hunCmd.slice(3).trim();
        const { rows } = await pool.query<{ word: string; chosung: string; word_len: number }>(
          `SELECT word, chosung, word_len FROM dict_words WHERE word LIKE $1 OR chosung LIKE $1 LIMIT 35`,
          [`%${keyword}%`]
        );
        if (rows.length === 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 검색 결과 없음: "${keyword}"`)] } });
        }
        const lines = [`🔍 "${keyword}" 검색 결과 (${rows.length}개)\n`, ...rows.map((r) => `${r.word} (${r.chosung}, ${r.word_len}자)`)];
        return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
      }

      return res.json({ version: "2.0", template: { outputs: [plainText(
        "훈민정음 관리 명령어:\n관리 훈민 추가 [단어]\n관리 훈민 삭제 [단어]\n관리 훈민 검색 [단어/초성]"
      )] } });
    }

    // ── 신형 유물 관리 ──────────────────────────────────────
    if (cmd.startsWith("유물 ") || cmd === "유물") {
      const relicCmd = cmd.slice(3).trim(); // "유물 " 이후 부분
      const ADMIN_GRADE_LABEL: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S', 6: 'SS' };
      const ADMIN_GRADE_MAP: Record<string, RelicGrade> = { D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6 };

      // 닉네임 파싱 (첫 토큰)
      const tokens = relicCmd.split(/\s+/);
      const targetNick = tokens[0];
      if (!targetNick) {
        return res.json({ version: "2.0", template: { outputs: [plainText(
          "사용법:\n" +
          "관리 유물 [닉]                            — 유물 목록\n" +
          "관리 유물 [닉] [번호] 등급 [D/C/B/A/S/SS] — 등급 변경\n" +
          "관리 유물 [닉] [번호] 강화 [0-20]          — 강화 변경\n" +
          "관리 유물 [닉] [번호] 레벨 [1-50]          — 레벨 변경\n" +
          "관리 유물 [닉] [시작~끝] 등급/강화/레벨 [값] — 일괄 변경\n" +
          "  예) 관리 유물 도혁 3~20 등급 SS\n" +
          "  예) 관리 유물 도혁 1~8 강화 20\n" +
          "  예) 관리 유물 도혁 1~8 레벨 30"
        )] } });
      }

      // 닉네임으로 유저 찾기
      const targetUser = getRanking().find((u) => u.nickname === targetNick || u.nickname.includes(targetNick));
      if (!targetUser) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 유저 없음: ${targetNick}`)] } });
      }

      // 유물 목록만 조회 (토큰이 닉네임뿐일 때)
      if (tokens.length === 1) {
        const relics = await getUserRelics(targetUser.userId);
        if (relics.length === 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`${targetUser.nickname}: 보유 유물 없음`)] } });
        }
        const lines = [`🗃️ ${targetUser.nickname} 유물 목록\n`];
        relics.forEach((r, i) => {
          const name = getRelicName(r.typeId, r.grade as RelicGrade);
          lines.push(`[${i + 1}] #${r.relicId} ${ADMIN_GRADE_LABEL[r.grade] ?? r.grade}등급 ${name} +${r.enhance}강 Lv${r.level} (${r.effectValue}%) ${r.isMain ? '⭐메인' : '보관'}`);
        });
        return res.json({ version: "2.0", template: { outputs: [plainText(lines.join("\n"))] } });
      }

      const relicIdxStr = tokens[1]; // 목록 인덱스(1-based), relic_id, 또는 "시작~끝" 범위
      const subCmd      = tokens[2]; // "등급" | "강화" | "레벨"
      const valueStr    = tokens[3];

      if ((subCmd !== "등급" && subCmd !== "강화" && subCmd !== "레벨") || !valueStr) {
        return res.json({ version: "2.0", template: { outputs: [plainText(
          "사용법:\n" +
          "관리 유물 [닉] [번호] 등급 [D/C/B/A/S/SS]\n" +
          "관리 유물 [닉] [번호] 강화 [0-20]\n" +
          "관리 유물 [닉] [번호] 레벨 [1-50]\n" +
          "관리 유물 [닉] [시작~끝] 등급/강화/레벨 [값]"
        )] } });
      }

      const allRelics = await getUserRelics(targetUser.userId);

      // ── 범위(일괄) 처리 ──────────────────────────────────────
      const rangeMatch = relicIdxStr.match(/^(\d+)~(\d+)$/);
      if (rangeMatch) {
        const from = parseInt(rangeMatch[1]);
        const to   = parseInt(rangeMatch[2]);
        if (from < 1 || to < from || to > allRelics.length) {
          return res.json({ version: "2.0", template: { outputs: [plainText(
            `❌ 범위 오류: 1~${allRelics.length} 내에서 [시작~끝] 형식으로 입력하세요.\n예) 관리 유물 ${targetNick} 1~${allRelics.length} 레벨 30`
          )] } });
        }
        const targets = allRelics.slice(from - 1, to); // 1-based → 0-based slice
        const results: string[] = [];

        for (const r of targets) {
          if (subCmd === "등급") {
            const newGrade = ADMIN_GRADE_MAP[valueStr.toUpperCase()];
            if (!newGrade) {
              return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 등급은 D/C/B/A/S/SS 중 하나를 입력하세요.`)] } });
            }
            const eff = calcEffectValue(newGrade, r.level, r.enhance);
            await pool.query(`UPDATE relics SET grade=$1, effect_value=$2 WHERE relic_id=$3`, [newGrade, eff, r.relicId]);
            results.push(`#${r.relicId} ${ADMIN_GRADE_LABEL[r.grade]}→${ADMIN_GRADE_LABEL[newGrade]} (${r.effectValue}%→${eff}%)`);
          } else if (subCmd === "강화") {
            const newEnhance = parseInt(valueStr);
            if (isNaN(newEnhance) || newEnhance < 0) {
              return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 강화 단계는 0 이상 숫자를 입력하세요.`)] } });
            }
            const eff = calcEffectValue(r.grade as RelicGrade, r.level, newEnhance);
            await pool.query(`UPDATE relics SET enhance=$1, effect_value=$2 WHERE relic_id=$3`, [newEnhance, eff, r.relicId]);
            results.push(`#${r.relicId} +${r.enhance}→+${newEnhance}강 (${r.effectValue}%→${eff}%)`);
          } else if (subCmd === "레벨") {
            const newLevel = parseInt(valueStr);
            if (isNaN(newLevel) || newLevel < 1) {
              return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 레벨은 1 이상 숫자를 입력하세요.`)] } });
            }
            const eff = calcEffectValue(r.grade as RelicGrade, newLevel, r.enhance);
            await pool.query(`UPDATE relics SET level=$1, effect_value=$2 WHERE relic_id=$3`, [newLevel, eff, r.relicId]);
            results.push(`#${r.relicId} Lv${r.level}→Lv${newLevel} (${r.effectValue}%→${eff}%)`);
          }
        }
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 일괄 ${subCmd} 변경 완료! (${from}~${to}번, 총 ${results.length}개)\n` +
          `${targetUser.nickname}\n\n` +
          results.join("\n")
        )] } });
      }

      // ── 개별 처리 ──────────────────────────────────────────
      const idx = parseInt(relicIdxStr);
      const targetRelic = isNaN(idx) ? null : allRelics[idx - 1] ?? allRelics.find(r => r.relicId === idx) ?? null;
      if (!targetRelic) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 유물 번호 오류: ${relicIdxStr}\n(목록 번호 또는 relic_id 입력)`)] } });
      }

      // ── 등급 변경 ──
      if (subCmd === "등급") {
        const newGrade = ADMIN_GRADE_MAP[valueStr.toUpperCase()];
        if (!newGrade) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 등급은 D/C/B/A/S/SS 중 하나를 입력하세요.`)] } });
        }
        const newEffect = calcEffectValue(newGrade, targetRelic.level, targetRelic.enhance);
        await pool.query(
          `UPDATE relics SET grade = $1, effect_value = $2 WHERE relic_id = $3`,
          [newGrade, newEffect, targetRelic.relicId]
        );
        const beforeName = getRelicName(targetRelic.typeId, targetRelic.grade as RelicGrade);
        const afterName  = getRelicName(targetRelic.typeId, newGrade);
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 등급 변경 완료!\n` +
          `${targetUser.nickname} / #${targetRelic.relicId}\n` +
          `${GRADE_NAMES[targetRelic.grade as RelicGrade]}등급 ${beforeName}\n` +
          `→ ${GRADE_NAMES[newGrade]}등급 ${afterName}\n` +
          `효과: ${targetRelic.effectValue}% → ${newEffect}%`
        )] } });
      }

      // ── 강화 변경 ──
      if (subCmd === "강화") {
        const newEnhance = parseInt(valueStr);
        if (isNaN(newEnhance) || newEnhance < 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 강화 단계는 0 이상 숫자를 입력하세요.`)] } });
        }
        const newEffect = calcEffectValue(targetRelic.grade as RelicGrade, targetRelic.level, newEnhance);
        await pool.query(
          `UPDATE relics SET enhance = $1, effect_value = $2 WHERE relic_id = $3`,
          [newEnhance, newEffect, targetRelic.relicId]
        );
        const name = getRelicName(targetRelic.typeId, targetRelic.grade as RelicGrade);
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 강화 변경 완료!\n` +
          `${targetUser.nickname} / #${targetRelic.relicId} ${name}\n` +
          `${targetRelic.enhance}강 → ${newEnhance}강\n` +
          `효과: ${targetRelic.effectValue}% → ${newEffect}%`
        )] } });
      }

      // ── 레벨 변경 ──
      if (subCmd === "레벨") {
        const newLevel = parseInt(valueStr);
        if (isNaN(newLevel) || newLevel < 1) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 레벨은 1 이상 숫자를 입력하세요.`)] } });
        }
        const newEffect = calcEffectValue(targetRelic.grade as RelicGrade, newLevel, targetRelic.enhance);
        await pool.query(
          `UPDATE relics SET level = $1, effect_value = $2 WHERE relic_id = $3`,
          [newLevel, newEffect, targetRelic.relicId]
        );
        const name = getRelicName(targetRelic.typeId, targetRelic.grade as RelicGrade);
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ 레벨 변경 완료!\n` +
          `${targetUser.nickname} / #${targetRelic.relicId} ${name}\n` +
          `Lv${targetRelic.level} → Lv${newLevel}\n` +
          `효과: ${targetRelic.effectValue}% → ${newEffect}%`
        )] } });
      }
    }

    // ── 모니터링: ML v3.2 파라미터 적용 후 2주 지표 대시보드 ─────────────
    if (cmd === "모니터링" || cmd.startsWith("모니터링 ")) {
      const sub = cmd.slice(cmd.indexOf(' ') + 1).trim(); // "모니터링" 이후 인자
      try {
        if (sub === "요약") {
          // 최근 14일 추이 요약
          const summary = await format14DaySummary();
          return res.json({ version: "2.0", template: { outputs: [plainText(summary)] } });
        }
        // 일별 상세 (날짜 인자 또는 오늘)
        const dateArg = /^\d{4}-\d{2}-\d{2}$/.test(sub) ? sub : undefined;
        const metrics = await getDailyMetrics(dateArg);
        return res.json({ version: "2.0", template: { outputs: [plainText(formatMetrics(metrics))] } });
      } catch (err) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 지표 조회 실패: ${String(err)}`)] } });
      }
    }

    // ── 배율: 통합 랭킹 A·B 조회 / 변경 ─────────────────────
    if (cmd === "배율" || cmd.startsWith("배율 ")) {
      const parts = cmd.split(/\s+/);
      if (parts.length === 1) {
        // 조회
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `⚖️ 통합 랭킹 배율 현황\n\n` +
          `effectSum 배율 (A): ${COMBINED_A}\n` +
          `relicPower 배율 (B): ${COMBINED_B}\n\n` +
          `현재 공식:\n통합점수 = 포인트 + effectSum×${COMBINED_A} + relicPower×${COMBINED_B}\n\n` +
          `※ 환경변수: COMBINED_EFFECT_WEIGHT / COMBINED_POWER_WEIGHT\n` +
          `※ 런타임 변경: 관리 배율 [A] [B]`
        )] } });
      }
      // 변경: 관리 배율 [A] [B]
      const newA = Number(parts[1]);
      const newB = Number(parts[2]);
      if (!Number.isFinite(newA) || !Number.isFinite(newB) || newA < 0 || newB < 0) {
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `❌ 유효하지 않은 값이에요.\n사용법: 관리 배율 [A] [B]\n예) 관리 배율 1400 15.6`
        )] } });
      }
      const prevA = COMBINED_A, prevB = COMBINED_B;
      COMBINED_A = newA;
      COMBINED_B = newB;
      return res.json({ version: "2.0", template: { outputs: [plainText(
        `✅ 통합 랭킹 배율이 변경되었어요.\n\n` +
        `A: ${prevA} → ${COMBINED_A}\n` +
        `B: ${prevB} → ${COMBINED_B}\n\n` +
        `새 공식:\n통합점수 = 포인트 + effectSum×${COMBINED_A} + relicPower×${COMBINED_B}\n\n` +
        `※ 서버 재시작 시 환경변수 값(또는 기본값)으로 초기화돼요.`
      )] } });
    }

    // ── 이벤트 [닉] / 이벤트 [닉] [+n/-n]: 참여횟수 조회·조절 ──
    if (cmd.startsWith("이벤트 ")) {
      const parts  = cmd.slice(4).trim().split(/\s+/);
      const nick   = parts[0];
      const rawAdj = parts[1];

      // ── 전체 현황 조회 ──────────────────────────────────────
      if (nick === "현황") {
        const [totalRes, perUserRes, roomRes] = await Promise.all([
          pool.query<{ users: string; invites: string }>(
            `SELECT COUNT(DISTINCT user_id) AS users, COUNT(*) AS invites FROM event_invite_log`,
          ),
          pool.query<{ nickname: string; invite_cnt: string; claimed_cnt: string }>(
            `SELECT u.nickname,
                    COUNT(eil.room_id)                              AS invite_cnt,
                    COALESCE(SUM(ecl.claimed_count), 0)            AS claimed_cnt
             FROM event_invite_log eil
             JOIN users u ON u.user_id = eil.user_id
             LEFT JOIN event_claim_log ecl
               ON ecl.user_id = eil.user_id
              AND ecl.activity_date = eil.activity_date
             GROUP BY u.nickname, eil.user_id
             ORDER BY invite_cnt DESC`,
          ),
          pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM event_room_claimed`),
        ]);
        const totalUsers   = parseInt(totalRes.rows[0].users, 10);
        const totalInvites = parseInt(totalRes.rows[0].invites, 10);
        const totalClaimed = parseInt(roomRes.rows[0].c, 10);
        const lines = perUserRes.rows.map((r, i) =>
          `${i + 1}. ${r.nickname}  참여 ${r.invite_cnt}회 / 수령 ${r.claimed_cnt}회`
        );
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `📊 이벤트 전체 현황\n\n` +
          `참여 유저 수 : ${totalUsers}명\n` +
          `총 참여횟수  : ${totalInvites}회\n` +
          `총 수령횟수  : ${totalClaimed}회\n\n` +
          (lines.length > 0 ? lines.join("\n") : "참여 기록 없음")
        )] } });
      }

      // ── 특정 유저 조회·조절 ─────────────────────────────────
      const found  = getRanking().find(u => u.nickname === nick || u.nickname.includes(nick));
      if (!found) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 유저 없음: ${nick}`)] } });
      }
      const targetId = found.userId;
      const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // 현재 상태 조회 (조회 + 조절 공통)
      const [inviteRes, claimRes, unclaimedRes] = await Promise.all([
        pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1`, [targetId]),
        pool.query<{ c: string }>(`SELECT COALESCE(SUM(claimed_count),0) AS c FROM event_claim_log WHERE user_id = $1`, [targetId]),
        pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM event_invite_log eil WHERE eil.user_id = $1 AND NOT EXISTS (SELECT 1 FROM event_room_claimed erc WHERE erc.room_id = eil.room_id AND erc.activity_date = eil.activity_date)`, [targetId]),
      ]);
      const totalInvite   = parseInt(inviteRes.rows[0].c, 10);
      const totalClaimed  = parseInt(claimRes.rows[0].c, 10);
      const unclaimed     = parseInt(unclaimedRes.rows[0].c, 10);

      // 조회만
      if (!rawAdj) {
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `📋 이벤트 현황 — ${found.nickname}\n\n` +
          `총 참여횟수  : ${totalInvite}회\n` +
          `수령 완료    : ${totalClaimed}회\n` +
          `미수령(가능) : ${unclaimed}회`
        )] } });
      }

      const adj = parseInt(rawAdj.replace(/^\+/, ""), 10);
      if (isNaN(adj) || adj === 0) {
        return res.json({ version: "2.0", template: { outputs: [plainText(`❌ 숫자 오류: ${rawAdj}\n예) 관리 이벤트 도혁 +3\n예) 관리 이벤트 도혁 -2`)] } });
      }

      if (adj > 0) {
        // 참여횟수 추가: event_invite_log에 fake row 삽입
        for (let i = 0; i < adj; i++) {
          const fakeRoomId = `admin_fake_${Date.now()}_${i}`;
          await pool.query(
            `INSERT INTO event_invite_log (user_id, room_id, activity_date) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`,
            [targetId, fakeRoomId, todayKST],
          );
        }
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ ${found.nickname} 이벤트 참여횟수 +${adj}회 추가\n→ 총 ${totalInvite + adj}회 / 미수령 ${unclaimed + adj}회`
        )] } });
      } else {
        // 참여횟수 차감: 미수령 row부터 삭제
        const delCount = Math.min(-adj, unclaimed);
        if (delCount === 0) {
          return res.json({ version: "2.0", template: { outputs: [plainText(`⚠️ 미수령 참여횟수가 0이라 차감할 수 없어요.`)] } });
        }
        await pool.query(
          `DELETE FROM event_invite_log WHERE ctid IN (
            SELECT eil.ctid FROM event_invite_log eil
            WHERE eil.user_id = $1
            AND NOT EXISTS (SELECT 1 FROM event_room_claimed erc WHERE erc.room_id = eil.room_id AND erc.activity_date = eil.activity_date)
            LIMIT $2
          )`,
          [targetId, delCount],
        );
        return res.json({ version: "2.0", template: { outputs: [plainText(
          `✅ ${found.nickname} 이벤트 참여횟수 -${delCount}회 차감\n→ 총 ${totalInvite - delCount}회 / 미수령 ${unclaimed - delCount}회`
        )] } });
      }
    }

    // 알 수 없는 관리 명령어
    return res.json({ version: "2.0", template: { outputs: [plainText(`❓ 알 수 없는 명령어: ${cmd}\n"관리 help" 로 목록 확인`)] } });
  }

  // eval 명령어 (특정 관리자만 사용 가능)
  if (EVAL_USER_IDS.has(userId) && utterance.startsWith("eval ")) {
    const code = utterance.slice(5);
    try {
      // ── eval 헬퍼 함수들 ──────────────────────────────────────────
      /** 닉네임으로 랭킹 유저 찾기 */
      const findUser = (nick: string) =>
        getRanking().find((u) => u.nickname === nick) ?? null;

      /** 초성퀴즈 주제 목록 (주제명 - n개 형식) */
      const cats = () => {
        const cnt = getCategoryCountMap();
        return getQuizCategories()
          .map((c) => `${c} - ${cnt.get(c) ?? 0}개`)
          .join("\n");
      };

      /** 특정 주제의 퀴즈 목록 샘플 (기본 10개) */
      const sampleQuizzes = (category: string, n = 10) =>
        quizBank
          .filter((q) => q.category === category)
          .slice(0, n)
          .map((q) => `[${q.id}] ${q.chosung} → ${q.answer}`)
          .join("\n");

      /** 포인트 직접 추가 (닉네임, 양수/음수) */
      const addScore = async (nick: string, amount: number) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        await adminAddScore(u.userId, amount);
        return `${nick} 포인트 ${amount > 0 ? "+" : ""}${amount}P 완료`;
      };

      /** 신형 유물 목록 조회 (닉네임) */
      const listRelics = async (nick: string) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        const rs = await getUserRelics(u.userId);
        if (!rs.length) return `${nick}: 유물 없음`;
        const G: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
        return rs.map((r, i) =>
          `[${i + 1}] #${r.relicId} ${G[r.grade]}${getRelicName(r.typeId, r.grade as RelicGrade)} +${r.enhance}강 Lv${r.level} ${r.effectValue}% ${r.isMain ? '⭐' : ''}`
        ).join("\n");
      };

      /** 신형 유물 등급 변경 (닉네임, 목록번호(1-based) 또는 relic_id, 'D'|'C'|'B'|'A'|'S') */
      const setRelicGrade = async (nick: string, relicIdx: number, gradeStr: string) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        const GMAP: Record<string, RelicGrade> = { D: 1, C: 2, B: 3, A: 4, S: 5, SS: 6 };
        const newGrade = GMAP[gradeStr.toUpperCase()];
        if (!newGrade) return `등급 오류: ${gradeStr} (D/C/B/A/S 중 입력)`;
        const rs = await getUserRelics(u.userId);
        const r = rs[relicIdx - 1] ?? rs.find(x => x.relicId === relicIdx) ?? null;
        if (!r) return `유물 번호 없음: ${relicIdx}`;
        const eff = calcEffectValue(newGrade, r.level, r.enhance);
        await pool.query(`UPDATE relics SET grade=$1, effect_value=$2 WHERE relic_id=$3`, [newGrade, eff, r.relicId]);
        return `✅ #${r.relicId} ${GRADE_NAMES[r.grade as RelicGrade]}→${GRADE_NAMES[newGrade]}등급 완료 (효과 ${r.effectValue}%→${eff}%)`;
      };

      /** 신형 유물 강화 단계 변경 (닉네임, 목록번호(1-based) 또는 relic_id, 0-20) */
      const setRelicEnhance = async (nick: string, relicIdx: number, enhance: number) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        if (enhance < 0) return `강화 범위 오류: 0 이상 입력`;
        const rs = await getUserRelics(u.userId);
        const r = rs[relicIdx - 1] ?? rs.find(x => x.relicId === relicIdx) ?? null;
        if (!r) return `유물 번호 없음: ${relicIdx}`;
        const eff = calcEffectValue(r.grade as RelicGrade, r.level, enhance);
        await pool.query(`UPDATE relics SET enhance=$1, effect_value=$2 WHERE relic_id=$3`, [enhance, eff, r.relicId]);
        return `✅ #${r.relicId} ${r.enhance}강→${enhance}강 완료 (효과 ${r.effectValue}%→${eff}%)`;
      };

      /** 유저의 특정 유물 하나 레벨 변경 (닉네임, 목록번호(1-based) 또는 relic_id, 1~30) */
      const setOneRelicLevel = async (nick: string, relicIdx: number, level: number) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        const rs = await getUserRelics(u.userId);
        const r = rs[relicIdx - 1] ?? rs.find(x => x.relicId === relicIdx) ?? null;
        if (!r) return `유물 번호 없음: ${relicIdx}`;
        const eff = calcEffectValue(r.grade as RelicGrade, level, r.enhance);
        await pool.query(`UPDATE relics SET level=$1, effect_value=$2 WHERE relic_id=$3`, [level, eff, r.relicId]);
        const G: Record<number, string> = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S' };
        return `✅ #${r.relicId} ${G[r.grade]}${getRelicName(r.typeId, r.grade as RelicGrade)} Lv${r.level}→Lv${level} 완료 (효과 ${r.effectValue}%→${eff}%)`;
      };

      /** 유저의 모든 유물 레벨 일괄 변경 (닉네임, 1~30) */
      const setRelicLevel = async (nick: string, level: number) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        if (level < 1) return `레벨 범위 오류: 1 이상 입력`;
        const rs = await getUserRelics(u.userId);
        if (!rs.length) return `${nick}: 유물 없음`;
        for (const r of rs) {
          const eff = calcEffectValue(r.grade as RelicGrade, level, r.enhance);
          await pool.query(
            `UPDATE relics SET level=$1, effect_value=$2 WHERE relic_id=$3`,
            [level, eff, r.relicId]
          );
        }
        return `✅ ${nick}의 유물 ${rs.length}개 → 레벨 ${level} 완료`;
      };

      /** 모든 종류(8종) S등급 20강 유물 지급 (닉네임) */
      const giveRelics = async (nick: string) => {
        const u = findUser(nick);
        if (!u) return `유저 없음: ${nick}`;
        const TYPE_IDS = [1, 2, 3, 4, 7, 8, 9, 10];
        const GRADE = 5; const ENHANCE = 20; const EFFECT = 28.10;
        const existingMain = await pool.query(
          `SELECT relic_id FROM relics WHERE owner_id = $1 AND is_main = TRUE`, [u.userId]
        );
        const hasMain = (existingMain.rowCount ?? 0) > 0;
        for (let i = 0; i < TYPE_IDS.length; i++) {
          await pool.query(
            `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value)
             VALUES ($1, $2, $3, 1, $4, 0, $5, $6)`,
            [u.userId, TYPE_IDS[i], GRADE, ENHANCE, !hasMain && i === 0, EFFECT]
          );
        }
        return `✅ ${nick}에게 S등급 20강 유물 8종 지급 완료`;
      };

      /** 현재 랭킹 상위 n명 */
      const topN = (n = 10) =>
        getRanking()
          .slice(0, n)
          .map((u, i) => `${i + 1}. ${u.nickname} - ${u.score}P`)
          .join("\n");

      /** quizBank 전체 통계 */
      const stats = () => {
        const cnt = getCategoryCountMap();
        const total = quizBank.length;
        const catCount = cnt.size;
        return `총 ${total}개 퀴즈 / ${catCount}개 주제`;
      };

      // ─────────────────────────────────────────────────────────────

      // eslint-disable-next-line no-eval
      const result = await (async () => eval(`(async () => { ${code} })()`))();
      // 카카오 응답 객체(version: "2.0")이면 그대로 전송
      if (result !== null && typeof result === "object" && (result as Record<string, unknown>).version === "2.0") {
        return res.json(result);
      }
      const output = result === undefined ? "(undefined)" : typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return res.json({ version: "2.0", template: { outputs: [plainText(`✅ ${String(output).slice(0, 900)}`)] } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.json({ version: "2.0", template: { outputs: [plainText(`❌ ${msg.slice(0, 900)}`)] } });
    }
  }

  // 초성주제
  if (utterance === "초성주제") {
    return res.json({
      version: "2.0",
      template: { outputs: [plainText(`🔮 초성퀴즈 주제 목록\n\n${getCategoryListText()}`)] },
    });
  }

  // 종료 명령어
  if (utterance === "그만" || utterance === "종료" || utterance === "끝") {
    // 훈민정음 세션 종료
    const hunmin = getHunminSession(roomId);
    if (hunmin) {
      const mvps = calcMvps(hunmin.roundScores, hunmin.participants);
      for (const m of mvps) {
        rewardHunminWord(roomId, m.userId, m.nickname, mvpBonus(m.count));
      }
      endHunminSession(roomId);
      return res.json(hunminEndResponse(hunmin, [], userId));
    }
    // 초성퀴즈 세션 종료
    const session = getSession(roomId);
    if (session && !session.ended) {
      const quiz = getCurrentQuiz(session);
      suspendSession(roomId);
      return res.json(endCard(session, quiz?.answer, userId, roomId));
    }
  }

  // 초성퀴즈 시작 (주제선택 포함)
  const fbParsedCat = parseChosungCategory(utterance);
  const isChosungStartFb =
    utterance === "초성퀴즈" ||
    utterance === "초성퀴즈 시작" ||
    fbParsedCat !== null;

  if (!isChosungStartFb && utterance.startsWith("초성퀴즈 ")) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 존재하지 않는 주제예요!`),
        card({
          title: "🔮 존재하지 않는 주제예요!",
          description: `아래의 초성주제 버튼을 눌러 확인하세요!`,
          buttons: [
            { action: "message", label: "초성주제", messageText: "@초능력자 초성주제" },
            { action: "message", label: "초성퀴즈", messageText: "@초능력자 초성퀴즈" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  if (isChosungStartFb) {
    const existingHunmin = getHunminSession(roomId);
    if (existingHunmin) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 훈민정음 진행 중`),
          card({
            title: "🔮 훈민정음 진행 중",
            description: `현재 방에서 훈민정음이 진행 중이에요!\n먼저 게임을 종료해주세요.`,
            buttons: [STOP_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const existing = getSession(roomId);
    if (existing && !existing.ended) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}}, 초성퀴즈 진행 중!`),
          card({
            title: "🔮 초성퀴즈 진행 중",
            description: `현재 방에서 초성퀴즈가 진행 중이에요!\n먼저 게임을 종료해주세요.`,
            buttons: [STOP_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    if (existing?.ended) endSession(roomId);
    const session = createSession(roomId, userId, "chosung", fbParsedCat ?? undefined);
    const quiz = getCurrentQuiz(session)!;
    if (isAdminUser(userId)) console.log(`[ADMIN] 초성퀴즈 정답: ${quiz.answer}`);
    const fbHintsLeft = calcMaxHints(quiz.answer) > 0;
    const fbStartPts = session.currentPts;
    if (needCategoryNudge(roomId, fbParsedCat === null)) {
      _activeNudge += "\n🔮 [TIP] /초성퀴즈 '카테고리' 를 입력해보세요!";
    }
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 님이 초성퀴즈를 시작했어요!${consumeTip()}`),
        card({
          title: `🔮 문제 : ${quiz.chosung}`,
          description: [
            fbParsedCat ? `선택주제 : ${quiz.category}` : `랜덤주제 : ${quiz.category}`,
            `최대상금 : ${fbStartPts}P${getUserScore(userId)?.total === 0 ? " (기본 500P 제공)" : ""}`,
          ].join("\n"),
          buttons: fbHintsLeft ? [HINT_BTN, MENTION_BTN] : [STOP_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 훈민정음 시작 (새 멀티플레이 방식)
  if (utterance === "훈민정음" || utterance === "훈민정음 시작") {
    const existingChosung = getSession(roomId);
    if (existingChosung && !existingChosung.ended) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}}, 초성퀴즈 진행 중!`),
          card({
            title: "🔮 초성퀴즈 진행 중",
            description: `현재 방에서 초성퀴즈가 진행 중이에요!\n먼저 게임을 종료해주세요.`,
            buttons: [STOP_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    if (existingChosung?.ended) endSession(roomId);
    const existingHunmin = getHunminSession(roomId);
    if (existingHunmin) {
      const phaseText = existingHunmin.phase === "registration" ? "참여자 등록 중" : "게임 진행 중";
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 훈민정음 진행 중`),
          card({
            title: "🔮 훈민정음 진행 중",
            description: `현재 방에서 훈민정음이 ${phaseText}이에요!\n먼저 게임을 종료해주세요.`,
            buttons: [STOP_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    try {
      const session = await createHunminSession(roomId);
      if (isAdminUser(userId)) {
        getHunminCandidateWords(session.chosung, session.wordLen).then((words) => {
          console.log(`[ADMIN] 훈민정음 초성: ${session.chosung} (${session.wordLen}글자) — 가능한 단어 ${words.length}개: ${words.join(", ")}`);
        });
      }
      registerHunminParticipant(session, userId, nickname);
      startAutoTimer(session);

      return res.json(multiOutput(
        [
        mentionText(`🔮 {{#mentions.u}} 님이 훈민정음을 시작했어요!`),
        card({
          title: "25초 동안 참여자를 모집할게요.",
          description: [
            `✅ 다 모이면 "시작"을 꼭 눌러주세요!`,
            ...(getUserScore(userId)?.total === 0 ? [`기본 제공 포인트 : 500P`] : []),
          ].join("\n"),
          buttons: [REG_BTN, START_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    } catch {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 오류가 발생했어요`),
          card({ title: "❌ 오류가 발생했어요", description: "잠시 후 다시 시도해주세요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
  }

  // 지금시작 (시작 버튼)
  if (utterance === "지금시작" || utterance === "시작") {
    const hunmin = getHunminSession(roomId);
    // 훈민정음 진행 중에 "시작" 입력은 단어 제출로 처리 (초성이 ㅅㅈ 인 경우 등)
    if (!(utterance === "시작" && hunmin?.phase === "playing")) {
      if (!hunmin) {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음이 없어요`),
            card({
              title: "이미 종료됐거나 등록 시간이 초과됐어요.",
              description: "",
              buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      if (hunmin.phase !== "registration") {
        return res.json(multiOutput(
          [
            mentionText(`🔮 {{#mentions.u}} 이미 게임이 진행 중이에요`),
            card({
              title: "🔮 이미 게임이 진행 중이에요",
              description: `현재 참여자 : ${hunmin.participants.size}명`,
              buttons: [STOP_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      // 시작 버튼을 누른 사람이 미등록이면 자동 등록
      if (!hunmin.participants.has(userId)) {
        registerHunminParticipant(hunmin, userId, nickname);
      }
      const isSoloStart = hunmin.participants.size === 1;
      if (hunmin.registrationTimer) clearTimeout(hunmin.registrationTimer);
      transitionToPlaying(hunmin);
      return res.json(multiOutput(
        [
          mentionText(`🎮 {{#mentions.u}} 님이 게임을 시작했어요!`),
          card({
            title: "🎮 훈민정음 시작!",
            description: [
              `초성 : ${hunmin.chosung}`,
              `참여자 : ${hunmin.participants.size}명`,
              `⏱ 제한시간: 45초`,
              ...(isSoloStart ? [`📢 MVP 보너스 없음`] : []),
            ].join("\n"),
            buttons: [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // "시작" + playing → 아래 단어 제출 핸들러로 이동
  }

  // 참여자등록
  if (utterance === "참여") {
    const hunmin = getHunminSession(roomId);
    if (!hunmin) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 진행 중인 훈민정음이 없어요!`),
          card({
            title: "🔮 훈민정음이 없어요",
            description: "먼저 훈민정음을 시작해주세요.",
            buttons: [{ action: "message", label: "훈민정음", messageText: "@초능력자 훈민정음" }],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    if (hunmin.phase === "playing") {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 이미 게임이 시작됐어요!`),
          card({
            title: "🎮 훈민정음 진행 중",
            description: [
              `초성 : ${hunmin.chosung}`,
              `버튼을 눌러 @초능력자 를 입력 후 단어를 제출하세요!`,
              `⏱ 남은 시간 : ${getRemainingPlaySec(hunmin)}초`,
            ].join("\n"),
            buttons: [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    if (hunmin.participants.has(userId)) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 이미 등록되어 있어요!`),
          card({
            title: "✅ 이미 등록됨",
            description: `현재 ${hunmin.participants.size}명 등록 중\n곧 모집이 종료됩니다.`,
            buttons: [REG_BTN, START_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    registerHunminParticipant(hunmin, userId, nickname);
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 참여자 등록 완료!`),
        card({
          description: [
            `현재 ${hunmin.participants.size}명 등록됨`,
            `시작 버튼을 눌러 시작해주세요! 곧 종료됩니다!`,
          ].join("\n"),
          buttons: [START_BTN, STOP_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }


  // 랭킹
  if (utterance === "랭킹") {
    return res.json(await buildRankingResponse(roomId, userId, nickname));
  }

  // 출석체크
  if (
    utterance === "출석체크" || utterance === "출첵" ||
    utterance === "ㅊㅊ" || utterance === "ㅊㅅㅊㅋ"
  ) {
    const result = recordAttendance(userId, nickname);
    if (result === "already") {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.me}} 님은 오늘 이미 출석체크를 했어요! ✅`),
          card({
            title: "📅 출석체크 완료",
            description: `오늘은 이미 출석 도장을 찍었어요!\n00시가 되면 다시 출석체크할 수 있어요.`,
            buttons: RESTART_BTNS,
          }),
        ],
        { me: { type: "botUserKey", id: userId } }
      ));
    }
    const newTotal = getUserScore(userId)?.score ?? ATTENDANCE_REWARD;
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.me}} 님, 출석체크 완료! 🎉`),
        card({
          title: "📅 출석체크 성공!",
          description: [
            `🔮 +${fmt(ATTENDANCE_REWARD)}P 지급!`,
            `🔮 누적 포인트 : ${scoreDisplay(newTotal)}`,
            ``,
            `내일 00시 이후에 다시 출석체크하세요!`,
          ].join("\n"),
          buttons: RESTART_BTNS,
        }),
      ],
      { me: { type: "botUserKey", id: userId } }
    ));
  }

  // ── 닉네임 변경 ──────────────────────────────────────────────────────────
  if (utterance === "닉네임변경" || utterance === "닉네임 변경") {
    if (isAdminUser(userId) || isSubAdminUser(userId)) {
      return res.json(multiOutput(
        [
          mentionText(`✏️ {{#mentions.u}} 닉네임 변경 불가`),
          card({ title: "✏️ 닉네임 변경 불가", description: "운영진은 닉네임을 변경할 수 없어요." }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    pendingNickChange.set(userId, true);
    return res.json({
      version: "2.0",
      context: {
        values: [{ name: "nick_change_pending", lifeSpan: 1, ttl: 600 }],
      },
      template: {
        outputs: [
          {
            textCard: withLayout({
              title: "✏️ 닉네임 변경",
              description: [
                `변경할 닉네임을 입력해주세요.`,
                `• 최대 8자, 띄어쓰기 불가`,
                `• 욕설·비속어·정치인 이름 불가`,
                ``,
                `취소하려면 아래 버튼 또는 "취소"를 입력하세요.`,
              ].join("\n"),
              buttons: [
                { action: "message", label: "취소", messageText: "@초능력자 취소" },
                { action: "mention", label: "변경하기" },
              ],
            }),
          },
        ],
      },
    });
  }

  // 내정보 / 프로필
  const isMyInfoCmd  = utterance === "프로필";
  const isProfileMention = utterance.startsWith("프로필 ") || utterance.startsWith("프로필\u00a0");
  if (isMyInfoCmd || isProfileMention) {
    // 멘션된 상대방 추출 (프로필 @xxx 형태)
    let targetId   = userId;
    let targetNick = nickname;
    let viewingOther = false;

    if (isProfileMention) {
      // 디버그: 실제 요청 body 구조 확인
      logger.info({ utterance, actionParams: req.body?.action?.params ?? {}, entities: req.body?.userRequest?.entities ?? [], extra: req.body?.userRequest?.extra ?? {}, user: req.body?.userRequest?.user ?? {} }, "[프로필DEBUG]");

      // ── 카카오 mention 데이터 추출 (여러 포맷 시도) ──
      // 1) userRequest.entities 배열 형식
      const entities: any[] = req.body?.userRequest?.entities ?? [];
      // 첫 번째는 봇(@초능력자) 멘션일 수 있으므로 모두 수집
      const mentionEntities = entities.filter((e: any) => e.type === "mention");
      // 여러 mention 중 첫 번째 entity가 봇이면 두 번째를 사용
      const mentionEnt = mentionEntities.length > 1 ? mentionEntities[1] : mentionEntities[0];

      // 2) extra.mentions 배열 형식 (카카오 일부 버전)
      const extraMentions: any[] =
        req.body?.userRequest?.extra?.mentions ??
        req.body?.extra?.mentions ?? [];
      // 봇 자신 제외: sender userId와 다른 첫 번째 항목
      const extraMent = extraMentions.find(
        (m: any) => (m.id ?? m.userId ?? m.value) && (m.id ?? m.userId ?? m.value) !== userId
      );

      // 3) action.params 방식 — sys.user.mention 엔티티 활성화 시 (공식 방법)
      //    파라미터 키: sys_user_mention1, sys_user_mention2, ...
      //    값: '{"botUserKey":"xxx","appUserId":"yyy"}' (JSON 문자열)
      const actionParams: Record<string, string> = req.body?.action?.params ?? {};
      let sysUserMentionId: string | undefined;
      for (const [key, val] of Object.entries(actionParams)) {
        if (key.startsWith("sys_user_mention")) {
          try {
            const parsed = typeof val === "string" ? JSON.parse(val) : val;
            const candidate: string | undefined = parsed?.botUserKey ?? parsed?.appUserId;
            if (candidate && candidate !== userId) {
              sysUserMentionId = candidate;
              break;
            }
          } catch { /* 파싱 실패 시 무시 */ }
        }
      }

      // ── botUserKey 추출 (우선순위: sys.user.mention > entities > extra.mentions) ──
      const extractedId: string | undefined =
        // sys.user.mention 파라미터 방식 (공식, 가장 정확)
        sysUserMentionId ||
        // entities 방식
        mentionEnt?.value || mentionEnt?.userId || mentionEnt?.id ||
        // extra.mentions 방식
        extraMent?.id || extraMent?.userId || extraMent?.value;

      if (extractedId && extractedId !== userId) {
        targetId = extractedId;
        const fromDB = getUserScore(targetId);
        targetNick = fromDB?.nickname
          ?? (mentionEnt?.raw as string | undefined)?.replace(/^@/, "")
          ?? (extraMent?.nickname as string | undefined)
          ?? `능력자_${targetId.slice(-6)}`;
        viewingOther = true;
      } else {
        // ── Fallback: 닉네임으로 랭킹보드 검색 ──
        const rawText = utterance.slice("프로필 ".length).replace(/^@/, "").trim();

        // 카카오가 멘션을 "사용자N" 으로 익명화한 경우 → @멘션 기능 미지원 안내
        if (/^사용자\d+$/.test(rawText)) {
          return res.json(multiOutput(
            [
              mentionText(`📢 {{#mentions.u}} @멘션 프로필 조회는 지원되지 않아요`),
              card({
                title: "📢 @멘션으로 프로필 조회는 지원되지 않아요",
                description:
                  "카카오 API 정책상 멘션된 사람의 정보를 받아오지 못해요.\n" +
                  "대신 닉네임으로 검색할 수 있어요!\n\n" +
                  "💡 사용법: 프로필 닉네임\n" +
                  "예) 프로필 도혁",
                buttons: RESTART_BTNS,
              }),
            ],
            { u: { type: "botUserKey", id: userId } },
          ));
        }

        if (rawText) {
          const allUsers = getRanking();
          const found = allUsers.find(
            (u) => u.nickname === rawText || u.nickname.includes(rawText)
          );
          if (found) {
            targetId   = found.userId;
            targetNick = found.nickname;
            viewingOther = true;
          } else {
            return res.json(multiOutput(
              [
                mentionText(`❓ {{#mentions.u}} 사용자를 찾을 수 없어요`),
                card({
                  title: "❓ 사용자를 찾을 수 없어요",
                  description: `닉네임 "${rawText}"의 기록이 없어요.\n아직 게임을 한 번도 하지 않은 사용자예요.\n상대방이 먼저 게임을 플레이해야 정보가 생겨요!\n\n💡 사용법: 프로필 닉네임`,
                  buttons: RESTART_BTNS,
                }),
              ],
              { u: { type: "botUserKey", id: userId } },
            ));
          }
        }
      }
    }

    let global = getUserScore(targetId);
    // rankingBoard에 있으면 저장된 닉네임 우선 (Kakao 전송 닉네임보다 우선)
    if (global?.nickname) targetNick = global.nickname;
    // 메모리에 없으면 DB에서 직접 조회 (서버 재시작 후에도 올바른 값 표시)
    if (!global) {
      try {
        const row = await pool.query(
          "SELECT nickname, score, correct, total, hunmin_wins, hunmin_max, hunmin_total, jamo_streak, last_jamo_date FROM users WHERE user_id = $1",
          [targetId]
        );
        if (row.rows[0]) {
          const r = row.rows[0];
          global = { userId: targetId, nickname: r.nickname, score: Number(r.score), correct: Number(r.correct), total: Number(r.total), hunminWins: Number(r.hunmin_wins ?? 0), hunminMax: Number(r.hunmin_max ?? 0), hunminTotal: Number(r.hunmin_total ?? 0), jamoStreak: Number(r.jamo_streak ?? 0), lastJamoDate: r.last_jamo_date ?? '' } as any;
          if (r.nickname) targetNick = r.nickname;
        }
      } catch { /* 무시 */ }
    }
    const attended     = hasAttendedToday(targetId);
    const totalPlayed  = global?.total   ?? 0;
    const totalCorrect = global?.correct ?? 0;
    const accuracy     = totalPlayed > 0 ? Math.round((totalCorrect / totalPlayed) * 100) : 0;
    const hunminWins   = global?.hunminWins  ?? 0;
    const hunminMax    = global?.hunminMax   ?? 0;
    const hunminTotal  = global?.hunminTotal ?? 0;
    const jamoStreak   = global?.jamoStreak  ?? 0;

    // 배틀 통계는 자신의 프로필에서만 조회
    const battleStats = viewingOther ? null : await getUserBattleStats(userId);
    const battleLine  = battleStats && battleStats.total > 0
      ? `승률: ${battleStats.winRate}% (${battleStats.total}전 ${battleStats.wins}승 ${battleStats.losses}패)`
      : battleStats ? `승률: 기록 없음` : null;

    const profileRanking  = getRanking();
    const profileRankIdx  = profileRanking.findIndex((u) => u.userId === targetId);
    const profileScore    = global?.score ?? 0;
    const globalRankLine  = spServerRankLine(targetId) || "🌟 초능력자 순위 : 집계 중...";
    const roomRankDisp    = spRoomRankLine(targetId, roomId) || "🌟 방 초능력자 순위 : 집계 중...";
    const pointRankLine   = profileRankIdx >= 0 ? `💎 포인트 전체 순위 : ${profileRankIdx + 1}위` : "💎 포인트 전체 순위 : 순위 없음";

    // 유물 정보 조회
    const targetInvLimit  = await getRelicInvLimitDB(targetId);
    const targetInventory = await getUserInventory(targetId, targetInvLimit);
    const profileMainRelic = targetInventory.mainRelic;
    const profileRelicLine = profileMainRelic
      ? `${GRADE_STARS[profileMainRelic.grade]} [${GRADE_NAMES[profileMainRelic.grade]}] ${getRelicName(profileMainRelic.typeId, profileMainRelic.grade)} Lv.${profileMainRelic.level} ${profileMainRelic.enhance}강 | +${profileMainRelic.effectValue}%`
      : `없음 (유물뽑기로 획득하세요!)`;

    // 업적 칭호 계산
    const profileAllRelics = [
      ...(targetInventory.mainRelic ? [targetInventory.mainRelic] : []),
      ...targetInventory.storageRelics,
    ];
    const titleInput: TitleInput = {
      correct:         global?.correct          ?? 0,
      total:           global?.total            ?? 0,
      hunminWins:      global?.hunminWins        ?? 0,
      hunminMax:       global?.hunminMax         ?? 0,
      hunminTotal:     global?.hunminTotal       ?? 0,
      jamoTotalCount:  (global as any)?.jamoTotalCount  ?? 0,
      jamoBestStreak:  (global as any)?.jamoBestStreak  ?? 0,
      jamoHardCount:   (global as any)?.jamoHardCount   ?? 0,
      jamoNormalCount: (global as any)?.jamoNormalCount ?? 0,
      jamoEasyCount:   (global as any)?.jamoEasyCount   ?? 0,
      currentScore:    global?.score             ?? 0,
      attendanceDays:  0,
      relics:          profileAllRelics.map(r => ({ grade: r.grade, enhance: r.enhance, level: r.level, typeId: r.typeId })),
    };
    const profileTopTitle = getTopTitle(titleInput);

    // 초능력자 지표 조회
    const profilePowerStats = await calculateEffectiveBattlePower(targetId);
    const profileRelicAsset = await getUserRelicAssetValue(targetId);
    // 순위 계산과 동일한 함수 사용 → 카드의 "점수"와 "n-1위까지 n점 남음" gap이 일치
    const profileSuperpowerScore = getSpScore(targetId);

    const lines = [
      "[초성퀴즈]",
      `맞힌 문제 : ${totalCorrect}문제`,
      `정답률 : ${accuracy}%`,
      "",
      "[훈민정음]",
      `우승 횟수 : ${hunminWins}회`,
      `한 게임 최다 정답갯수 : ${hunminMax}개`,
      `모든 게임 총 정답갯수 : ${hunminTotal}개`,
      "",
      "[자모연성]",
      `연속 정답 : ${jamoStreak}회`,
      "",
      ...(battleLine ? ["[배틀]", battleLine, ""] : []),
      "[랭킹]",
      globalRankLine,
      roomRankDisp,
      "",
      `[유물] ${profileRelicLine}`,
      ``,
      ...(viewingOther ? [] : [`🗓️ 오늘의 출석 : ${attended ? "✅ 완료" : "❌ 미완료 (@초능력자 출첵)"}`]),
    ];

    const profileWebUrl = `${PROFILE_BASE_URL}/profile?uid=${encodeURIComponent(targetId)}`;
    const detailBtn: KakaoButton = {
      action: "webLink",
      label: "자세히",
      webLinkUrl: profileWebUrl,
    };

    const profileCardLines = [
      `• 닉네임 : ${targetNick}`,
      `• 칭호 : ${getScoreTitle(calcTopPct(profileRankIdx, profileRanking.length))}`,
      ...(profileTopTitle ? [`• 대표 업적 : ${profileTopTitle.icon} ${profileTopTitle.name}`] : []),
      `• 포인트 : ${fmt(global?.score ?? 0)}P`,
      ``,
      `🌟 초능력자 점수 : ${fmt(profileSuperpowerScore)}점`,
      `🏺 유물 자산 : ${fmt(profileRelicAsset)}P`,
      `⚔️ 전투력 : ${profilePowerStats.totalPower.toFixed(2)}`,
      ``,
      globalRankLine,
      ...(roomRankDisp ? [roomRankDisp] : []),
      pointRankLine,
      ``,
      `• 유물 : ${profileRelicLine}`,
      ...(battleLine ? [``, `[배틀] ${battleLine}`] : []),
    ];

    if (viewingOther) {
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.target}} 님의 초능력자 정보에요!`),
          card({
            description: [
              ...profileCardLines,
              ``,
              `• 오늘의 출석 : ${attended ? "✅ 완료" : "❌ 미완료"}`,
            ].join("\n"),
            buttons: [detailBtn],
          }),
        ],
        { target: { type: "botUserKey", id: targetId } }
      ));
    }

    const myRelicBtn: KakaoButton  = { action: "message", label: "내 유물", messageText: "@초능력자 내유물" };
    const attendBtn:  KakaoButton  = { action: "message", label: "출첵",   messageText: "@초능력자 출첵" };

    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.me}} 님의 초능력자 정보에요!`),
        card({
          description: [
            ...profileCardLines,
            ``,
            `• 오늘의 출석 : ${attended ? "✅ 완료" : "❌ 미완료"}`,
          ].join("\n"),
          buttons: [detailBtn, myRelicBtn, attendBtn],
        }),
      ],
      { me: { type: "botUserKey", id: userId } }
    ));
  }

  // ── 다음문제 명령어 (초성퀴즈 전용) ────────────────
  if (utterance === "다음문제" || utterance === "다음 문제") {
    // 초성퀴즈 세션이 있으면 처리
    const session = getSession(roomId);
    if (session) {
      jamoJustFinished.delete(roomId);
      session.ended = false;
      const quiz = nextQuiz(session);
      session.lastActivityAt = new Date();
      resetSessionTimer(roomId);
      if (isAdminUser(userId)) console.log(`[ADMIN] 다음문제 정답: ${quiz.answer}`);
      const nextHintsLeft = calcMaxHints(quiz.answer) > 0;
      if (needCategoryNudge(roomId, !session.quizCategory)) {
        _activeNudge += "\n🔮 [TIP] /초성퀴즈 '카테고리' 를 입력해보세요!";
      }
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} ⏭️ 다음 문제입니다!${consumeTip()}`),
          card({
            title: `🔮 문제 : ${quiz.chosung}`,
            description: [
              session.quizCategory ? `선택주제 : ${quiz.category}` : `랜덤주제 : ${quiz.category}`,
              `최대상금 : ${session.currentPts}P`,
              `정답률 : ${fmtRate(quiz.attemptCount, quiz.correctCount)}`,
            ].join("\n"),
            buttons: nextHintsLeft ? [HINT_BTN, MENTION_BTN] : [STOP_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 자모연성 세션이 있거나 TTL 플래그가 남아 있으면 → 다음퀴즈 안내
    const jamoSessForNext = getJamoSession(roomId);
    const jamoFinishedForNext = jamoJustFinished.get(roomId);
    if (jamoSessForNext || (jamoFinishedForNext && Date.now() - jamoFinishedForNext.at < JAMO_NEXT_TTL)) {
      return res.json(multiOutput(
        [
          mentionText(`🔤 {{#mentions.u}} 자모연성은 "다음퀴즈"를 사용하세요!`),
          card({
            title: "🔤 자모연성에는 \"다음퀴즈\"를 사용하세요!",
            description: "자모연성 다음 문제는 \"다음퀴즈\" 버튼을 눌러주세요.",
            buttons: [JAMO_NEXT_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    if (jamoFinishedForNext) jamoJustFinished.delete(roomId);

    return res.json(multiOutput(
      [
        mentionText(`💡 {{#mentions.u}}, 게임이 없어요!`),
        card({ description: "먼저 게임을 시작해주세요!", buttons: RESTART_BTNS }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 다음퀴즈 명령어 (자모연성 전용) ────────────────
  if (utterance === "다음퀴즈" || utterance === "다음 퀴즈") {
    // 초성퀴즈가 진행 중이면 안내
    const chosungSessForJamoNext = getSession(roomId);
    if (chosungSessForJamoNext && !chosungSessForJamoNext.ended) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 초성퀴즈 진행 중`),
          card({
            title: "🔮 초성퀴즈 진행 중",
            description: "다음퀴즈는 자모연성 전용이에요.\n초성퀴즈 다음 문제는 \"다음문제\" 버튼을 눌러주세요.",
            buttons: [NEXT_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 자모연성이 방금 끝난 경우 → 다음 문제 출제
    const jamoFinished = jamoJustFinished.get(roomId);
    if (jamoFinished && Date.now() - jamoFinished.at < JAMO_NEXT_TTL) {
      jamoJustFinished.delete(roomId);
      const nextDiff = jamoFinished.difficulty;
      clearJamoSession(roomId);
      const nextSess = await generateJamoQuestion(roomId, userId, nextDiff);
      if (!nextSess) {
        return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 문제 생성 실패`), card({ title: "❌ 문제 생성 실패", description: "잠시 후 다시 시도해주세요." })], { u: { type: "botUserKey", id: userId } }));
      }
      const diffLabelMap: Record<JamoDifficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };
      const nextTimeLimitMin = Math.floor(JAMO_CONFIG.EXPIRY_MS / 60000);
      return res.json(multiOutput(
        [
          mentionText(`🔤 {{#mentions.u}} 님의 자모연성! [${diffLabelMap[nextDiff]}]`),
          card({
            title: "🔤 자모연성",
            description: [
              `자모: ${formatJamoList(nextSess.jamo)}`,
              ``,
              formatChoices(nextSess.choices),
              ``,
              `⏰ 제한 시간: ${nextTimeLimitMin}분`,
              `"제출" 버튼을 눌러 @초능력자 를 멘션 후 번호를 입력하세요!`,
            ].join("\n"),
            buttons: [JAMO_BTN_QUIT, JAMO_BTN_SUBMIT],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 자모연성 세션이 아직 진행 중인 경우
    const jamoSessForNext = getJamoSession(roomId);
    if (jamoSessForNext) {
      return res.json(multiOutput(
        [
          mentionText(`📢 {{#mentions.u}} 자모연성 진행 중`),
          card({
            title: "📢 자모연성 진행 중",
            description: [
              `자모: ${formatJamoList(jamoSessForNext.jamo)}`,
              "",
              formatChoices(jamoSessForNext.choices),
              "",
              '"제출" 버튼으로 답하거나, 포기 후 다음퀴즈를 시작해주세요.',
            ].join("\n"),
            buttons: [JAMO_BTN_QUIT, JAMO_BTN_SUBMIT],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    if (jamoFinished) jamoJustFinished.delete(roomId);
    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.u}} ❌ 진행 중인 자모연성이 없어요.`),
        card({
          title: "자모연성을 시작해주세요!",
          description: "",
          buttons: [
            { action: "message", label: "프로필",   messageText: "@초능력자 프로필" },
            { action: "message", label: "자모연성", messageText: "@초능력자 자모연성" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ── 힌트 명령어 ────────────────────────────────
  if (utterance === "힌트" || utterance === "hint") {
    const session = getSession(roomId);
    if (!session || session.ended) {
      return res.json(multiOutput(
        [
          mentionText(`💡 {{#mentions.u}}, 진행 중인 게임이 없어요!`),
          card({
            description: "먼저 게임을 시작해주세요!",
            buttons: RESTART_BTNS,
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const quiz = getCurrentQuiz(session);
    if (!quiz) {
      endSession(roomId);
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 오류가 발생했어요. 다시 시작해주세요!`), card({ title: "오류가 발생했어요. 다시 시작해주세요!" })], { u: { type: "botUserKey", id: userId } }));
    }

    // 한글 음절 기반 힌트 최대 횟수 계산
    const maxHints = calcMaxHints(quiz.answer);

    if (maxHints <= 0 || session.hintsUsed >= maxHints) {
      const curDisplay = buildHintDisplayRandom(quiz.answer, new Set(session.revealedKoreanIndices));
      return res.json(multiOutput(
        [
          mentionText(`{{#mentions.u}} 더 이상 힌트를 사용할 수 없어요!`),
          card({
            title: "🅧 힌트 소진",
            description: `현재: ${curDisplay}\n마지막 한 글자는 스스로 맞혀보세요!`,
            buttons: [NEXT_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const ok = deductFragments(userId, nickname, HINT_COST);
    if (!ok) {
      const current = getUserScore(userId)?.score ?? 0;
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}} 포인트가 부족해요`),
          card({
            title: "🔮 포인트가 부족해요",
            description: [
              `힌트 사용 비용 : ${fmt(HINT_COST)}P`,
              `현재 포인트 : ${fmt(current)}P`,
              ``,
              `/출첵을 하고 포인트를 모아보세요!`,
            ].join("\n"),
            buttons: [NEXT_BTN, MENTION_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 미공개 한글 인덱스 중 랜덤으로 1개 공개
    const koreanIndices = getKoreanCharIndices(quiz.answer);
    const unrevealed = koreanIndices.filter(i => !session.revealedKoreanIndices.includes(i));
    if (unrevealed.length > 0) {
      const picked = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      session.revealedKoreanIndices.push(picked);
    }
    session.hintsUsed += 1;
    session.lastActivityAt = new Date();
    resetSessionTimer(roomId);

    const hintDisplay = buildHintDisplayRandom(quiz.answer, new Set(session.revealedKoreanIndices));
    const remaining = getUserScore(userId)?.score ?? 0;
    const moreHintsLeft = session.hintsUsed < maxHints;

    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.u}} 님이 힌트 사용하였어요!`),
        card({
          title: `🔮 문제 : ${hintDisplay}`,
          description: [
            `${fmt(HINT_COST)}P 차감`,
            `잔여 포인트 : ${scoreDisplay(remaining)}`,
            `(힌트 ${session.hintsUsed}/${maxHints})`,
          ].join("\n"),
          buttons: moreHintsLeft ? [HINT_BTN, MENTION_BTN] : [NEXT_BTN, MENTION_BTN],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 자모연성 게임 ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // 자모연성 숫자 답변 처리 (1/2/3/4)
  {
    const jamoSess = getJamoSession(roomId);
    if (jamoSess && !jamoSess.processed && ["1","2","3","4"].includes(utterance)) {
      const choiceIdx = parseInt(utterance) - 1;
      const todayKST  = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
      const isFirst   = isFirstJamoToday(userId, todayKST);
      const streak    = jamoSess.userId === userId ? (getUserScore(userId)?.jamoStreak ?? 0) : 0;
      const result    = calcJamoReward(jamoSess, choiceIdx, streak, isFirst);
      jamoSess.processed = true;
      clearJamoSession(roomId);

      if (!result.correct) {
        recordWrong(userId, nickname);
        jamoJustFinished.set(roomId, { difficulty: jamoSess.difficulty, at: Date.now() });
        return res.json(multiOutput(
          [
            mentionText(`{{#mentions.u}} 님 틀렸어요! 정답은 「${result.answer}」`),
            card({
              title: "❌ 오답",
              description: [
                `자모: ${formatJamoList(jamoSess.jamo)}`,
                `정답: ${result.answer}`,
                ``,
                `다시 도전해봐요!`,
              ].join("\n"),
              buttons: [JAMO_NEXT_BTN],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }

      // 정답 처리
      // ── 콤보 판정 (자모연성 승리 등록 → 10분 내 5회 달성 시 60초 발동) ──
      const jamoComboTriggered = recordWin(userId, 'jamo');
      const jamoComboActive    = isComboActive(userId);

      // ── 유물 효과 적용 (자모 보너스 + 전체 보너스 + 콤보 보너스) ──
      const jamoRelicFx  = await getRelicEffectsDetailed(userId, ['jamo_bonus', 'all_bonus', 'combo_bonus']);
      const jamoRelicPct = jamoRelicFx.effects.jamoBonus + jamoRelicFx.effects.allBonus + jamoRelicFx.effects.comboBonus;
      const jamoRelicBonus = jamoRelicPct > 0 ? Math.round(result.pts * jamoRelicPct / 100) : 0;

      // ── 콤보 활성 시 +20% 보너스 ──
      const baseBeforeCombo  = result.pts + jamoRelicBonus;
      const jamoComboBonusPt = jamoComboActive ? Math.round(baseBeforeCombo * 0.2) : 0;
      const jamoPts          = baseBeforeCombo + jamoComboBonusPt;

      const newStreak = updateJamoStreak(userId, nickname, todayKST, jamoSess.difficulty);
      recordScore(userId, nickname, jamoPts, 'earn_jamo');
      const cumTotal  = getUserScore(userId)?.score ?? jamoPts;

      const scoreLines: string[] = [`기본: ${fmt(jamoSess.basePts)}P`];
      for (const bonus of result.bonuses) scoreLines.push(bonus);
      if (jamoRelicBonus > 0)   scoreLines.push(`🏛️ 유물 보너스: +${fmt(jamoRelicBonus)}P`);
      if (jamoComboBonusPt > 0) scoreLines.push(`🔥 콤보 보너스: +${fmt(jamoComboBonusPt)}P (+20%)`);
      scoreLines.push(``);
      scoreLines.push(`합계: +${fmt(jamoPts)}P`);

      const jamoComboLine = jamoComboTriggered
        ? `\n🔥 콤보 발동! 60초간 +20%`
        : jamoComboActive
        ? `\n🔥 콤보 진행 중 (${getComboRemainingSeconds(userId)}초 남음)`
        : '';

      const jamoRelicInfo = relicBreakdownLine(jamoRelicFx.mainPct, jamoRelicFx.storagePct);
      jamoJustFinished.set(roomId, { difficulty: jamoSess.difficulty, at: Date.now() });
      return res.json(multiOutput(
        [
          mentionText([
            `🔤 {{#mentions.u}} 님 정답!`,
            `+${fmt(jamoPts)}P`,
            ...(jamoRelicInfo ? [jamoRelicInfo] : []),
            `✅ 연속 정답 : ${newStreak}회`,
            `💰 총 포인트 : ${scoreDisplay(cumTotal)}`,
            ...(jamoComboLine ? [jamoComboLine.trimStart()] : []),
          ].join("\n")),
          card({
            title: "🔤 자모연성 정답!",
            description: [
              `정답: 「${result.answer}」`,
              ``,
              ...scoreLines,
            ].join("\n"),
            buttons: [JAMO_NEXT_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
  }

  // ── 타자게임 시작 ────────────────────────────────────────────────────────
  if (utterance === "타자게임" || utterance === "타자 게임") {
    const existingTyp = getTypingSession(userId);
    if (existingTyp) {
      return res.json(multiOutput(
        [
          mentionText(`⌨️ {{#mentions.u}} 타자게임 진행 중`),
          card({
            title: "⌨️ 타자게임 진행 중",
            description: [
              `아직 문장이 남아있어요!`,
              ``,
              `「${existingTyp.sentence}」`,
              ``,
              `위 문장을 그대로 입력해주세요.`,
              `포기하려면 "타자포기"를 입력하세요.`,
            ].join("\n"),
            buttons: [{ action: "message", label: "타자포기", messageText: "@초능력자 타자포기" }],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const typSession = startTypingSession(userId, roomId);
    return res.json(multiOutput(
      [
        mentionText(`⌨️ {{#mentions.u}} 님의 타자게임 시작!`),
        card({
          title: "⌨️ 타자게임",
          description: [
            `아래 문장을 정확하게 입력해보세요!`,
            ``,
            `「${typSession.sentence}」`,
            ``,
            `✅ 정확도 90% 이상이면 포인트 획득`,
            `⚡ 빠를수록 속도 보너스`,
            ``,
            `포기: "타자포기" 입력`,
          ].join("\n"),
          buttons: [{ action: "message", label: "타자포기", messageText: "@초능력자 타자포기" }],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 자모연성 게임 시작
  if (utterance === "자모연성" || utterance.startsWith("자모연성 ")) {
    const randomDiffLabels = ["쉬움", "보통", "어려움"] as const;
    const rawDiff = utterance === "자모연성"
      ? randomDiffLabels[Math.floor(Math.random() * randomDiffLabels.length)]
      : utterance.slice("자모연성 ".length).trim();
    const diffMap: Record<string, JamoDifficulty> = { "쉬움": "easy", "보통": "normal", "어려움": "hard" };
    const difficulty: JamoDifficulty = diffMap[rawDiff] ?? "normal";

    // 초성퀴즈 진행 중이면 자모연성 차단
    const activeChosungForJamo = getSession(roomId);
    if (activeChosungForJamo && !activeChosungForJamo.ended) {
      return res.json(multiOutput(
        [
          mentionText(`🔮 {{#mentions.u}}, 초성퀴즈가 진행 중이에요!`),
          card({
            title: "🔮 초성퀴즈 진행 중",
            description: "자모연성은 초성퀴즈가 끝난 후 이용해주세요.\n\"종료\"를 입력하면 게임을 끝낼 수 있어요.",
            buttons: [STOP_BTN],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const existingJamo = getJamoSession(roomId);
    if (existingJamo) {
      return res.json(multiOutput(
        [
          mentionText(`📢 {{#mentions.u}} 이미 자모연성이 진행 중이에요!`),
          card({
            title: "📢 이미 자모연성이 진행 중이에요!",
            description: [
              `현재 진행 중인 문제예요:`,
              `자모: ${formatJamoList(existingJamo.jamo)}`,
              ``,
              formatChoices(existingJamo.choices),
              ``,
              `"제출" 버튼을 눌러 @초능력자 를 멘션 후 번호를 입력하세요!`,
            ].join("\n"),
            buttons: [JAMO_BTN_QUIT, JAMO_BTN_SUBMIT],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const sess = await generateJamoQuestion(roomId, userId, difficulty);
    if (!sess) {
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 문제 생성 실패`), card({ title: "❌ 문제 생성 실패", description: "단어 DB를 확인해주세요. 잠시 후 다시 시도해주세요." })], { u: { type: "botUserKey", id: userId } }));
    }

    const diffLabel: Record<JamoDifficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };
    const timeLimitMin = Math.floor(JAMO_CONFIG.EXPIRY_MS / 60000);
    return res.json(multiOutput(
      [
        mentionText(`🔤 {{#mentions.u}} 님의 자모연성! [${diffLabel[difficulty]}]`),
        card({
          title: "🔤 자모연성",
          description: [
            `자모: ${formatJamoList(sess.jamo)}`,
            ``,
            formatChoices(sess.choices),
            ``,
            `⏰ 제한 시간: ${timeLimitMin}분`,
            `"제출" 버튼을 눌러 @초능력자 를 멘션 후 번호를 입력하세요!` 
          ].join("\n"),
          buttons: [JAMO_BTN_QUIT, JAMO_BTN_SUBMIT],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 신규 유물 시스템 ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // "내유물" / "내 유물(신규)" — 메인 유물 + 보관 현황
  if (utterance === "내유물" || utterance === "내 유물") {
    const invLimit  = await getRelicInvLimitDB(userId);
    const inventory = await getUserInventory(userId, invLimit);
    const main      = inventory.mainRelic;
    const count     = await getRelicCount(userId);

    if (!main) {
      // 메인 유물 없음 → 안내
      return res.json(multiOutput(
        [
          mentionText([
            `{{#mentions.u}} 님의 메인 유물`,
            `없음`,
            `보관함 : ${count}/${invLimit}`,
          ].join("\n")),
          card({
            title: "🏛️ 내 유물",
            description: "아직 유물이 없어요.\n유물뽑기로 첫 유물을 획득해보세요!",
            buttons: [RELIC_BTN_GACHA],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const mainTypeDef  = RELIC_TYPE_CATALOG.find(t => t.typeId === main.typeId);
    const mainName     = getRelicName(main.typeId, main.grade);
    const mainImg      = getNewRelicImageUrl(main.typeId, main.grade);
    const isMaxEnhance = main.enhance >= RELIC_CONFIG.MAX_ENHANCE;

    return res.json(multiOutput(
      [
        mentionText([
          `{{#mentions.u}} 님의 메인 유물`,
          `${GRADE_STARS[main.grade]} [${GRADE_NAMES[main.grade]}] ${mainName} Lv.${main.level} (+${main.enhance})`,
          `보관함 : ${count}/${invLimit}`,
        ].join("\n")),
        basicCard({
          title: mainName,
          description: [
            `${GRADE_STARS[main.grade]} [${GRADE_NAMES[main.grade]}등급] Lv.${main.level} ${main.enhance}강 · ID: ${main.relicId}`,
            `효과: ${mainTypeDef?.description ?? ''} +${main.effectValue}%`,
          ].join("\n"),
          imageUrl: mainImg,
          buttons: [RELIC_BTN_STORAGE, isMaxEnhance ? RELIC_BTN_FUSE : RELIC_BTN_UPGRADE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물보관함" — 보관 중인 유물 목록
  if (utterance === "유물보관함" || utterance === "유물 보관함") {
    const invLimit  = await getRelicInvLimitDB(userId);
    const inventory = await getUserInventory(userId, invLimit);
    const storage   = inventory.storageRelics;
    const count     = await getRelicCount(userId);

    const displayed = storage.slice(0, 60);
    // 번호→relicId 매핑 저장 (유물설정 번호 입력 시 참조)
    relicStorageMap.set(userId, displayed.map(r => r.relicId));

    const lines: string[] = [`📦 보관함 (${count}/${invLimit}칸)`];
    if (displayed.length === 0) {
      lines.push("보관 중인 유물이 없어요.");
    } else {
      displayed.forEach((r, i) => {
        const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
        lines.push(`${i + 1}. ${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${getRelicName(r.typeId, r.grade)} Lv.${r.level} (+${r.enhance})`);
        lines.push(`- ${typeDef?.description ?? ''} +${r.effectValue}% (ID: ${r.relicId})`);
      });
      lines.push(`\n교체: @초능력자 유물설정 번호`);
    }

    return res.json(multiOutput(
      [
        mentionText([`{{#mentions.u}} 님의 유물 보관함`, ...lines].join("\n")),
        card({
          title: "📦 보관함 관리",
          description: "유물을 관리하거나 보관함을 확장할 수 있어요.",
          buttons: [RELIC_BTN_INFO, RELIC_BTN_DISMANTLE, RELIC_BTN_BREAK, RELIC_BTN_EXPAND],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물강화" (신규 — 메인 유물 강화)
  if (utterance === "유물강화" || utterance === "유물 강화") {
    const invLimit  = await getRelicInvLimitDB(userId);
    const inventory = await getUserInventory(userId, invLimit);
    const main      = inventory.mainRelic;
    if (!main) {
      const storage = inventory.storageRelics;
      if (storage.length > 0) {
        const candidates = storage.slice(0, 2);
        const idList = candidates
          .map(r => `• ID ${r.relicId}: ${formatRelicInfo(r)}`)
          .join("\n");
        const setButtons: KakaoButton[] = candidates.map(r => ({
          action: "message" as const,
          label: `ID ${r.relicId} 설정`,
          messageText: `@초능력자 유물설정 ${r.relicId}`,
        }));
        setButtons.push(RELIC_BTN_STORAGE);
        return res.json(multiOutput(
          [
            mentionText(`⚙️ {{#mentions.u}} 메인 유물을 설정해주세요`),
            card({
              title: "⚙️ 메인 유물을 설정해주세요",
              description: `보관함에 유물이 있지만 메인 유물이 설정되지 않았어요.\n아래 버튼으로 메인 유물을 선택하면 바로 강화할 수 있어요.\n\n📦 보관 중인 유물\n${idList}`,
              buttons: setButtons,
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      } else {
        return res.json(multiOutput(
          [
            mentionText(`❌ {{#mentions.u}} 유물이 없어요`),
            card({
              title: "❌ 유물이 없어요",
              description: "아직 획득한 유물이 없어요.\n유물뽑기로 첫 유물을 획득해보세요!",
              buttons: [RELIC_BTN_GACHA],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
    }

    if (main.enhance >= RELIC_CONFIG.MAX_ENHANCE) {
      const mainRelicLine = `메인 유물: ${GRADE_STARS[main.grade]} [${GRADE_NAMES[main.grade]}] ${getRelicName(main.typeId, main.grade)} ${RELIC_CONFIG.MAX_ENHANCE}강 (효과 +${main.effectValue}%)`;
      return res.json(multiOutput(
        [
          mentionText(`✅ {{#mentions.u}} 이미 최대 강화 단계예요`),
          card({
            title: "✅ 이미 최대 강화 단계예요",
            description: `${mainRelicLine}\n\n이미 최대 강화 단계에 도달했어요.\n유물합성으로 더 강한 유물을 만들어보세요!`,
            buttons: [RELIC_BTN_FUSE, RELIC_BTN_INFO],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const relicFx  = await getRelicEffects(userId);
    const costReduce = relicFx.enhanceCostReduce;
    const result = await enhanceRelic(userId, nickname, main.relicId, getUserScore(userId)?.score ?? 0, costReduce, deductFragments);
    if (!result.ok) {
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 강화 실패`), card({ title: "❌ 강화 실패", description: result.errorMsg ?? "알 수 없는 오류", buttons: [RELIC_BTN_INFO] })], { u: { type: "botUserKey", id: userId } }));
    }

    const successText = result.result === 'success'
      ? `✅ 강화 성공! ${result.enhanceBefore}강 → ${result.enhanceAfter}강`
      : `❌ 강화 실패 (${result.enhanceBefore}강 유지)`;
    logRelicEvent(nickname, result.result === 'success' ? '강화성공' : '강화실패',
      `${getRelicName(main.typeId, main.grade)} ${result.enhanceBefore}강→${result.enhanceAfter}강`);
    const costLine = costReduce > 0
      ? `비용: ${fmt(result.cost)}P (${costReduce}% 할인 적용)`
      : `비용: ${fmt(result.cost)}P`;
    const mainTypeDef  = RELIC_TYPE_CATALOG.find(t => t.typeId === main.typeId);
    const effectLabel  = mainTypeDef?.description ?? '효과';

    return res.json(multiOutput(
      [
        mentionText(`🏛️ {{#mentions.u}} 님 ${successText} | Lv.${main.level} · ${result.enhanceAfter}강 | ${effectLabel}: ${result.effectBefore.toFixed(1)}%→${result.effectAfter.toFixed(1)}%`),
        basicCard({
          title: "🏛️ 유물 강화",
          description: [
            `${GRADE_STARS[main.grade]} [${GRADE_NAMES[main.grade]}] ${getRelicName(main.typeId, main.grade)} · Lv.${main.level} · ID: ${main.relicId}`,
            ``,
            successText,
            `${effectLabel}: ${result.effectBefore.toFixed(1)}% → ${result.effectAfter.toFixed(1)}%`,
            ``,
            costLine,
          ].join("\n"),
          imageUrl: getNewRelicImageUrl(main.typeId, main.grade),
          buttons: [RELIC_BTN_INFO, RELIC_BTN_UPGRADE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물합성" — 사용법 안내
  if (utterance === "유물합성" || utterance === "유물 합성") {
    const c = RELIC_CONFIG.FUSE_COST;
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 유물합성 안내`),
        card({
          title: "🔮 유물합성",
          description: [
            `보관함에 있는 해당 등급 유물 전체를 재료로 합성해요.`,
            `재료가 많을수록 성공률이 높아져요!`,
            ``,
            `📋 명령어`,
            `유물합성 D — D등급 보관함 전체 → C 도전`,
            `유물합성 C — C등급 보관함 전체 → B 도전`,
            `유물합성 B — B등급 보관함 전체 → A 도전`,
            `유물합성 A — A등급 보관함 전체 → S 도전`,
            `유물합성 S — S등급 보관함 전체 → 🔴SS 도전 (최소 3개)`,
            ``,
            `💸 합성 비용`,
            `D→C ${c[0].toLocaleString('ko-KR')}P / C→B ${c[1].toLocaleString('ko-KR')}P`,
            `B→A ${c[2].toLocaleString('ko-KR')}P / A→S ${c[3].toLocaleString('ko-KR')}P`,
            `S→SS ${c[4].toLocaleString('ko-KR')}P (최대 성공률 45%)`,
          ].join("\n"),
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 구 방식 번호 입력 감지 → 변경 안내
  if (/^유물\s*합성\s+\d/.test(utterance)) {
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 유물합성 방식이 바뀌었어요!`),
        card({
          title: "🔮 유물합성 방식이 바뀌었어요!",
          description: [
            `번호 지정 방식(유물합성 1,2,3)은 더 이상 사용하지 않아요.`,
            ``,
            `📋 새 명령어`,
            `유물합성 D — D등급 보관함 전체 → C 도전`,
            `유물합성 C — C등급 보관함 전체 → B 도전`,
            `유물합성 B — B등급 보관함 전체 → A 도전`,
            `유물합성 A — A등급 보관함 전체 → S 도전`,
            `유물합성 S — S등급 보관함 전체 → 🔴SS 도전`,
            ``,
            `합성 전 재료 목록과 성공률을 먼저 확인할 수 있어요!`,
          ].join("\n"),
          buttons: [RELIC_BTN_FUSE, RELIC_BTN_STORAGE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물합성 D/C/B/A/S" — 1단계: 재료 목록 + 성공률 미리보기, 대기 상태 저장
  const fuseByGrade = utterance.match(/^유물\s*합성\s+([DCBAS])$/);
  if (fuseByGrade) {
    const FUSE_GRADE_MAP: Record<string, RelicGrade> = { D: 1, C: 2, B: 3, A: 4, S: 5 };
    const gradeLetter   = fuseByGrade[1]!;
    const grade         = FUSE_GRADE_MAP[gradeLetter] as RelicGrade;
    const isSSFuse      = gradeLetter === 'S';
    const minMaterials  = isSSFuse ? 3 : 2;

    const invLimit    = await getRelicInvLimitDB(userId);
    const inventory   = await getUserInventory(userId, invLimit);
    const gradeRelics = inventory.storageRelics.filter(r => r.grade === grade);

    if (gradeRelics.length === 0) {
      pendingFuseMap.delete(userId);
      return res.json(multiOutput([mentionText(`🔮 {{#mentions.u}} 보관함에 ${gradeLetter}등급 유물이 없어요`), card({ title: "🔮 유물합성", description: `보관함에 ${gradeLetter}등급 유물이 없어요.\n\n다른 등급을 선택하거나 유물뽑기로 먼저 유물을 모아보세요!`, buttons: [RELIC_BTN_GACHA, RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
    }
    if (gradeRelics.length < minMaterials) {
      pendingFuseMap.delete(userId);
      const minMsg = isSSFuse
        ? `S→SS 합성은 최소 3개의 S등급 유물이 필요해요!\n현재 보관함: ${gradeRelics.length}개\n\nA등급 합성으로 S등급을 더 모아보세요.`
        : `${gradeLetter}등급 유물이 ${gradeRelics.length}개뿐이에요.\n합성하려면 같은 등급 유물이 최소 2개 필요해요!\n\n유물뽑기로 더 모아보세요.`;
      return res.json(multiOutput([mentionText(`🔮 {{#mentions.u}} 합성 재료 부족`), card({ title: "🔮 유물합성 불가", description: minMsg, buttons: [RELIC_BTN_GACHA, RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
    }

    pendingFuseMap.set(userId, { grade, gradeLetter, relics: gradeRelics });

    const targetGrade = (grade + 1) as RelicGrade;
    const cost        = RELIC_CONFIG.FUSE_COST[grade - 1];
    const successRate = isSSFuse
      ? calcSSFuseSuccessRate(gradeRelics.map(r => ({ grade: r.grade, enhance: r.enhance })))
      : calcFuseSuccessRate(gradeRelics.map(r => ({ grade: r.grade, enhance: r.enhance })));
    const relicLines  = gradeRelics.map((r, i) =>
      `${i + 1}. ${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${getRelicName(r.typeId, r.grade)} ${r.enhance}강 (+${Number(r.effectValue).toFixed(1)}%)`
    );
    const ssFuseTip = isSSFuse
      ? [``, `⚠️ SS합성 최대 성공률 45% — 신중하게 결정하세요!`]
      : [];

    return res.json(multiOutput(
      [
        mentionText([
          `🔮 {{#mentions.u}} 님 유물합성 — 준비`,
          `📦 ${GRADE_STARS[grade]}${gradeLetter}등급 → ${GRADE_STARS[targetGrade]}${GRADE_NAMES[targetGrade]}등급 도전`,
          ``,
          ...relicLines,
        ].join("\n")),
        card({
          title: `📊 성공률: ${successRate}%`,
          description: [
            `💸 합성 비용: ${cost?.toLocaleString('ko-KR') ?? '?'}P`,
            ...ssFuseTip,
            ``,
            `이렇게 진행할까요?`,
            `특정 유물을 빼려면: 합성제거 번호,번호`,
          ].join("\n"),
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_FUSE_GO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "합성진행" — 2단계: 저장된 대기 상태로 합성 실행
  if (utterance === "합성진행") {
    const pending = pendingFuseMap.get(userId);
    if (!pending) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 합성 대기 없음`),
          card({
            title: "❌ 합성 대기 없음",
            description: `진행 중인 합성이 없어요.\n먼저 유물합성 D/C/B/A/S 명령어로 재료를 확인해주세요.`,
            buttons: [RELIC_BTN_FUSE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const { grade, gradeLetter, relics: pendingRelics } = pending;
    const relicIds = pendingRelics.map(r => r.relicId);
    pendingFuseMap.delete(userId);

    const fuseResult = await fuseRelics(userId, nickname, relicIds, deductFragments, refundPoints);

    if (!fuseResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 합성 오류`),
          card({
            title: "❌ 합성 오류",
            description: fuseResult.errorMsg ?? "알 수 없는 오류",
            buttons: [RELIC_BTN_FUSE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const consumed = `${gradeLetter}등급 유물 ${pendingRelics.length}개`;

    if (!fuseResult.success) {
      logRelicEvent(nickname, '합성실패',
        `${GRADE_NAMES[fuseResult.gradeBefore!]}등급 ×${pendingRelics.length} 소멸 (${fuseResult.successRate}%)`);
      return res.json(multiOutput(
        [
          mentionText([
            `💔 {{#mentions.u}} 님 합성 실패...`,
            `재료: ${consumed}`,
            ``,
            `❌ 성공률 ${fuseResult.successRate}% 도전 → 실패`,
            `💸 소모 포인트: ${fuseResult.pointCost!.toLocaleString('ko-KR')}P`,
          ].join("\n")),
          basicCard({
            title: "💔 유물합성 실패",
            description: [
              `재료: ${consumed}`,
              ``,
              `❌ 성공률: ${fuseResult.successRate}%`,
              `💸 소모 포인트: ${fuseResult.pointCost!.toLocaleString('ko-KR')}P`,
            ].join("\n"),
            imageUrl: getNewRelicImageUrl(pendingRelics[0]!.typeId, grade),
            buttons: [RELIC_BTN_FUSE, RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    logRelicEvent(nickname, '합성성공',
      `${GRADE_NAMES[fuseResult.gradeBefore!]}등급 ×${pendingRelics.length} → 성공`);
    const nr        = fuseResult.newRelic!;
    const nrName    = getRelicName(nr.typeId, nr.grade);
    const nrTypeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === nr.typeId);

    return res.json(multiOutput(
      [
        mentionText([
          `🔮 {{#mentions.u}} 님 합성 성공!`,
          `재료: ${consumed}`,
          `✅ 성공률 ${fuseResult.successRate}% 도전 → 성공!`,
          ``,
          `✨ 획득: ${GRADE_STARS[nr.grade]} [${GRADE_NAMES[nr.grade]}] ${nrName} | Lv.1 · 0강 | ${nrTypeDef?.description ?? ''} +${nr.effectValue}%`,
        ].join("\n")),
        basicCard({
          title: "🔮 유물합성 성공!",
          description: [
            `재료: ${consumed}`,
            `✅ 성공률: ${fuseResult.successRate}%`,
            ``,
            `✨ 획득: ${GRADE_STARS[nr.grade]} [${GRADE_NAMES[nr.grade]}] ${nrName}`,
            `Lv.1 · 0강 · ID: ${nr.relicId}`,
            `효과: ${nrTypeDef?.description ?? ''} +${nr.effectValue}%`,
            ``,
            `💸 소모 포인트: ${fuseResult.pointCost!.toLocaleString('ko-KR')}P`,
          ].join("\n"),
          imageUrl: getNewRelicImageUrl(nr.typeId, nr.grade),
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "합성제거 N,M,..." — 대기 목록에서 번호 제거 후 업데이트된 리스트 표시
  const fuseRemoveMatch = utterance.match(/^합성제거\s+([\d,\s]+)$/);
  if (fuseRemoveMatch) {
    const pending = pendingFuseMap.get(userId);
    if (!pending) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 합성 대기 없음`),
          card({
            title: "❌ 합성 대기 없음",
            description: `진행 중인 합성이 없어요.\n먼저 유물합성 D/C/B/A/S 명령어로 재료를 확인해주세요.`,
            buttons: [RELIC_BTN_FUSE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const removeNums = fuseRemoveMatch[1]!
      .split(",")
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n) && n >= 1);
    const removeSet  = new Set(removeNums);

    const { grade, gradeLetter, relics: prevRelics } = pending;
    const removedRelics = prevRelics.filter((_, i) => removeSet.has(i + 1));
    const remaining     = prevRelics.filter((_, i) => !removeSet.has(i + 1));
    const isSSFuseRemove = gradeLetter === 'S';
    const fuseMinRemove  = isSSFuseRemove ? 3 : 2;

    if (remaining.length < fuseMinRemove) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 제거 불가 — 합성은 최소 ${fuseMinRemove}개 필요해요`),
          card({
            title: "❌ 제거 불가",
            description: `해당 유물을 제거하면 재료가 ${remaining.length}개만 남아요.\n${isSSFuseRemove ? 'SS합성은' : '합성은'} 최소 ${fuseMinRemove}개의 유물이 필요하므로 제거할 수 없어요.`,
            buttons: [RELIC_BTN_FUSE_GO, RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    pendingFuseMap.set(userId, { grade, gradeLetter, relics: remaining });

    const targetGrade  = (grade + 1) as RelicGrade;
    const cost         = RELIC_CONFIG.FUSE_COST[grade - 1];
    const successRate  = isSSFuseRemove
      ? calcSSFuseSuccessRate(remaining.map(r => ({ grade: r.grade, enhance: r.enhance })))
      : calcFuseSuccessRate(remaining.map(r => ({ grade: r.grade, enhance: r.enhance })));
    const relicLines   = remaining.map((r, i) =>
      `${i + 1}. ${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${getRelicName(r.typeId, r.grade)} ${r.enhance}강 (+${Number(r.effectValue).toFixed(1)}%)`
    );
    const removedNames = removedRelics
      .map(r => `${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${getRelicName(r.typeId, r.grade)}`)
      .join(", ");

    return res.json(multiOutput(
      [
        mentionText([
          `🔮 {{#mentions.u}} 님 유물합성 — 업데이트`,
          `🗑️ 제거됨: ${removedNames}`,
          `📦 ${gradeLetter}등급 → ${GRADE_NAMES[targetGrade]}등급 도전`,
          ``,
          ...relicLines,
        ].join("\n")),
        card({
          title: `📊 성공률: ${successRate}%`,
          description: [
            `💸 합성 비용: ${cost?.toLocaleString('ko-KR') ?? '?'}P`,
            ``,
            `이렇게 진행할까요?`,
            `특정 유물을 빼려면: 합성제거 번호,번호`,
          ].join("\n"),
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_FUSE_GO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물판매 [ID optional]" — ID 생략 시 메인 유물 대상, ID 지정 시 해당 유물 대상
  if (utterance.startsWith("유물판매") || utterance.startsWith("유물 판매")) {
    const parts        = utterance.split(" ").filter(Boolean);
    const parsedId     = parseInt(parts[parts.length - 1] ?? "");
    let   relicId: number;
    if (isNaN(parsedId)) {
      // ID 생략 → 메인 유물 대상
      const invLimit  = await getRelicInvLimitDB(userId);
      const inventory = await getUserInventory(userId, invLimit);
      if (!inventory.mainRelic) {
        return res.json(multiOutput(
          [
            mentionText(`💰 {{#mentions.u}} 메인 유물이 없어요`),
            card({
              title: "💰 유물 판매",
              description: "메인 유물이 없어요.\n유물뽑기로 유물을 획득하거나 보관함에서 메인 유물을 설정해주세요.",
              buttons: [RELIC_BTN_GACHA, RELIC_BTN_STORAGE],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      relicId = inventory.mainRelic.relicId;
    } else {
      relicId = parsedId;
    }

    const isMainTarget = isNaN(parsedId);
    const sellResult = await sellRelic(userId, relicId, isMainTarget);
    if (!sellResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 판매 실패`),
          card({
            title: "❌ 판매 실패",
            description: sellResult.errorMsg ?? "알 수 없는 오류",
            buttons: [RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    recordScore(userId, nickname, sellResult.refund, 'earn_sell');
    const total = getUserScore(userId)?.score ?? 0;
    const soldName     = getRelicName(sellResult.typeId!, sellResult.grade!);
    const soldTypeDef  = RELIC_TYPE_CATALOG.find(t => t.typeId === sellResult.typeId);
    const soldGrade    = sellResult.grade!;
    const soldEnhance  = sellResult.enhance ?? 0;
    const soldLevel    = sellResult.level ?? 1;
    const soldEffect   = (sellResult.effectValue ?? 0).toFixed(1);
    return res.json(multiOutput(
      [
        mentionText(`💰 {{#mentions.u}} 님 유물 판매! ${GRADE_STARS[soldGrade]} [${GRADE_NAMES[soldGrade]}] ${soldName} Lv.${soldLevel} · +${soldEnhance}강 | +${fmt(sellResult.refund)}P`),
        basicCard({
          title: "💰 유물 판매 완료",
          description: [
            `${GRADE_STARS[soldGrade]} [${GRADE_NAMES[soldGrade]}] ${soldName}`,
            `Lv.${soldLevel} · +${soldEnhance}강`,
            `효과: ${soldTypeDef?.description ?? ''} +${soldEffect}%`,
            ``,
            `판매 금액: ${fmt(sellResult.refund)}P`,
            `💰 총 포인트: ${scoreDisplay(total)}`,
            ``,
            `💡 유물분해 명령으로 하위 등급 2개로 바꿀 수도 있어요.`,
          ].join("\n"),
          imageUrl: getNewRelicImageUrl(sellResult.typeId!, soldGrade),
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물분해 [ID optional]" — ID 생략 시 메인 유물 대상, ID 지정 시 해당 유물 대상
  if (utterance.startsWith("유물분해") || utterance.startsWith("유물 분해")) {
    const parts        = utterance.split(" ").filter(Boolean);
    const parsedId     = parseInt(parts[parts.length - 1] ?? "");
    let   relicId: number;
    if (isNaN(parsedId)) {
      // ID 생략 → 메인 유물 대상
      const invLimit  = await getRelicInvLimitDB(userId);
      const inventory = await getUserInventory(userId, invLimit);
      if (!inventory.mainRelic) {
        return res.json(multiOutput(
          [
            mentionText(`🔨 {{#mentions.u}} 메인 유물이 없어요`),
            card({
              title: "🔨 유물 분해",
              description: "메인 유물이 없어요.\n유물뽑기로 유물을 획득하거나 보관함에서 메인 유물을 설정해주세요.",
              buttons: [RELIC_BTN_GACHA, RELIC_BTN_STORAGE],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      relicId = inventory.mainRelic.relicId;
    } else {
      relicId = parsedId;
    }

    // 분해 전 보관함 용량 체크: 분해는 net +1이므로 빈 칸 ≥ 2 필요
    const invLimit    = await getRelicInvLimitDB(userId);
    const relicCount  = await getRelicCount(userId);
    if (relicCount >= invLimit - 1) {
      return res.json(multiOutput(
        [
          mentionText(`🔨 {{#mentions.u}} 유물 분해 불가`),
          card({
            title: "🔨 유물 분해 불가",
            description: `보관함이 꽉 찼어요. (${relicCount}/${invLimit})\n분해하면 유물 1개가 추가되는데 공간이 부족해요.\n먼저 유물을 판매해 자리를 만들어주세요.`,
            buttons: [RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const isMainTarget = isNaN(parsedId);
    const breakResult = await dismantleRelic(userId, relicId, isMainTarget);
    if (!breakResult.ok) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 분해 실패`),
          card({
            title: "❌ 분해 실패",
            description: breakResult.errorMsg ?? "알 수 없는 오류",
            buttons: [RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    const newRelics   = breakResult.newRelics!;
    const lowerGrade  = newRelics[0].grade;
    const newRelicLines = newRelics
      .map((r, i) => {
        const rTypeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
        return `${i + 1}. ${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${getRelicName(r.typeId, r.grade)}\n   Lv.1 · 0강 · ${rTypeDef?.description ?? ''} +${r.effectValue}% (ID ${r.relicId})`;
      })
      .join("\n");

    logRelicEvent(nickname, '분해',
      `${GRADE_NAMES[breakResult.dismantledGrade!]}등급 → ${GRADE_NAMES[lowerGrade]}×2`);
    return res.json(multiOutput(
      [
        mentionText(`🔨 {{#mentions.u}} 님 유물 분해! → ${GRADE_STARS[lowerGrade]} [${GRADE_NAMES[lowerGrade]}] 유물 2개 획득!`),
        basicCard({
          title: "🔨 유물 분해 완료",
          description: [`획득한 유물 (${GRADE_STARS[lowerGrade]} ${GRADE_NAMES[lowerGrade]}등급 ×2):`, newRelicLines].join("\n"),
          imageUrl: getNewRelicImageUrl(breakResult.dismantledTypeId!, breakResult.dismantledGrade!),
          buttons: [RELIC_BTN_INFO, RELIC_BTN_STORAGE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "보관함확장" — 보관함 한 칸 확장
  if (utterance === "보관함확장" || utterance === "보관함 확장") {
    const invLimit = await getRelicInvLimitDB(userId);
    const score    = getUserScore(userId)?.score ?? 0;
    const result   = await expandInventory(userId, nickname, invLimit, deductFragments);
    if (!result.ok) {
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 확장 실패`), card({ title: "❌ 확장 실패", description: result.errorMsg ?? "알 수 없는 오류", buttons: [RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
    }
    // 로컬 캐시 업데이트
    updateRelicInvLimit(userId, result.newLimit);
    return res.json(multiOutput(
      [
        mentionText(`📦 {{#mentions.u}} 님 보관함 확장! ${invLimit}칸 → ${result.newLimit}칸`),
        card({
          title: "📦 보관함 확장 완료",
          description: `비용: ${fmt(result.cost)}P\n현재 보관함: ${result.newLimit}칸`,
          buttons: [RELIC_BTN_STORAGE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // "유물설정 [번호 or ID]" — 메인 유물 변경
  if (utterance.startsWith("유물설정") || utterance.startsWith("유물 설정")) {
    const parts  = utterance.split(" ").filter(Boolean);
    const input  = parseInt(parts[parts.length - 1] ?? "");
    if (isNaN(input)) {
      return res.json(multiOutput(
        [
          mentionText(`⚙️ {{#mentions.u}} 메인 유물 설정`),
          card({
            title: "⚙️ 메인 유물 설정",
            description: "보관함 번호를 입력하세요.\n예: @초능력자 유물설정 1\n\n유물보관함에서 번호를 확인하세요.",
            buttons: [RELIC_BTN_STORAGE],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // 번호(1~8) → relicId 변환 (최근 유물보관함 조회 결과 기준)
    const storedIds = relicStorageMap.get(userId);
    const relicId = (storedIds && input >= 1 && input <= storedIds.length)
      ? storedIds[input - 1]
      : input; // 매핑 없으면 직접 relicId로 해석

    const ok = await setMainRelic(userId, relicId);
    if (!ok) {
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 설정 실패`), card({ title: "❌ 설정 실패", description: "해당 유물을 찾을 수 없어요.\n\n보관함에서 ID를 확인해 다시 시도해주세요.", buttons: [RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
    }

    // 설정된 유물 정보 조회하여 이름/등급/레벨/효과 표시
    const { rows: setRows } = await pool.query(
      `SELECT type_id, grade, enhance, level, effect_value FROM relics WHERE relic_id = $1 AND owner_id = $2`,
      [relicId, userId],
    );
    const setRow       = setRows[0];
    const setGrade     = setRow ? Number(setRow.grade) as RelicGrade : 1;
    const setEnhance   = setRow ? Number(setRow.enhance) : 0;
    const setLevel     = setRow ? Number(setRow.level ?? 1) : 1;
    const setEffect    = setRow ? Number(setRow.effect_value ?? 0).toFixed(1) : "0.0";
    const setTypeId    = setRow ? Number(setRow.type_id) : 1;
    const setName      = setRow ? getRelicName(setTypeId, setGrade) : `ID ${relicId}`;
    const setTypeDef   = RELIC_TYPE_CATALOG.find(t => t.typeId === setTypeId);

    return res.json(multiOutput(
      [
        mentionText(`🏛️ {{#mentions.u}} 님 메인 유물 설정 완료! ${GRADE_STARS[setGrade]} [${GRADE_NAMES[setGrade]}] ${setName} Lv.${setLevel} · +${setEnhance}강 | ${setTypeDef?.description ?? ''} +${setEffect}%`),
        basicCard({
          title: "✅ 메인 유물 설정 완료",
          description: [
            `${GRADE_STARS[setGrade]} [${GRADE_NAMES[setGrade]}] ${setName}`,
            `Lv.${setLevel} · +${setEnhance}강 · ID: ${relicId}`,
            `효과: ${setTypeDef?.description ?? ''} +${setEffect}%`,
          ].join("\n"),
          imageUrl: getNewRelicImageUrl(setTypeId, setGrade),
          buttons: [RELIC_BTN_INFO, RELIC_BTN_UPGRADE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 유물 레벨업 ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (utterance.startsWith("유물레벨업") || utterance.startsWith("유물 레벨업")) {
    // "유물레벨업 [ID]" 또는 "유물레벨업" (ID 없으면 메인 유물)
    const lvParts  = utterance.split(/\s+/).filter(Boolean);
    const lvIdRaw  = lvParts.length >= 2 ? parseInt(lvParts[lvParts.length - 1] ?? "") : NaN;
    const invLimit = await getRelicInvLimitDB(userId);

    let lvRelicId: number;
    let lvGrade: RelicGrade;
    let lvTypeName: string;
    let lvTypeDesc: string;
    let lvEnhance: number;

    if (!isNaN(lvIdRaw)) {
      // 특정 ID 유물 사용
      const { rows: lvRows } = await pool.query(
        `SELECT relic_id, type_id, grade, enhance FROM relics WHERE relic_id = $1 AND owner_id = $2`,
        [lvIdRaw, userId]
      );
      if (!lvRows.length) {
        return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 유물을 찾을 수 없어요`), card({ title: "❌ 유물을 찾을 수 없어요", description: `ID ${lvIdRaw}번 유물이 없거나 내 유물이 아니에요.\n유물보관함에서 올바른 ID를 확인해주세요.`, buttons: [RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
      }
      const lvCatalog = RELIC_TYPE_CATALOG.find(t => t.typeId === Number(lvRows[0].type_id));
      lvRelicId  = lvIdRaw;
      lvGrade    = Number(lvRows[0].grade) as RelicGrade;
      lvEnhance  = Number(lvRows[0].enhance ?? 0);
      lvTypeName = lvCatalog?.typeName ?? "유물";
      lvTypeDesc = lvCatalog?.description ?? '효과';
    } else {
      // 메인 유물 사용
      const inventory = await getUserInventory(userId, invLimit);
      const main      = inventory.mainRelic;
      if (!main) {
        return res.json(multiOutput(
          [
            mentionText(`❌ {{#mentions.u}} 메인 유물이 없어요`),
            card({
              title: "❌ 메인 유물이 없어요",
              description: "먼저 유물을 획득하고 메인으로 설정해주세요.\n유물보관함에서 유물을 선택해 메인으로 지정할 수 있어요.",
              buttons: [RELIC_BTN_GACHA, RELIC_BTN_STORAGE],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      const lvCatalog = RELIC_TYPE_CATALOG.find(t => t.typeId === main.typeId);
      lvRelicId  = main.relicId;
      lvGrade    = main.grade as RelicGrade;
      lvEnhance  = main.enhance;
      lvTypeName = getRelicName(main.typeId, main.grade as RelicGrade);
      lvTypeDesc = lvCatalog?.description ?? '효과';
    }

    const result = await levelUpRelic(userId, nickname, lvRelicId, deductFragments);
    if (!result.ok) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 레벨업 실패`),
          card({
            title: "❌ 레벨업 실패",
            description: result.errorMsg ?? "알 수 없는 오류가 발생했어요.\n잠시 후 다시 시도해주세요.",
            buttons: [RELIC_BTN_INFO],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    return res.json(multiOutput(
      [
        mentionText(`✨ {{#mentions.u}} 님 유물 레벨업! Lv.${result.levelBefore}→${result.levelAfter} · +${lvEnhance}강 | ${lvTypeDesc}: ${result.effectBefore.toFixed(1)}%→${result.effectAfter.toFixed(1)}%`),
        card({
          title: "✨ 유물 레벨업 성공!",
          description: [
            `${GRADE_STARS[lvGrade]} [${GRADE_NAMES[lvGrade]}] ${lvTypeName} · +${lvEnhance}강 · ID: ${lvRelicId}`,
            ``,
            `Lv.${result.levelBefore} → Lv.${result.levelAfter}`,
            `${lvTypeDesc}: ${result.effectBefore.toFixed(1)}% → ${result.effectAfter.toFixed(1)}%`,
            ``,
            `비용: ${fmt(result.cost)}P`,
          ].join("\n"),
          buttons: [RELIC_BTN_UPGRADE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 유물 각성 ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (utterance.startsWith("유물각성") || utterance.startsWith("유물 각성")) {
    // "유물각성 [ID]" 또는 "유물각성" (ID 없으면 메인 유물)
    const awParts  = utterance.split(/\s+/).filter(Boolean);
    const awIdRaw  = awParts.length >= 2 ? parseInt(awParts[awParts.length - 1] ?? "") : NaN;
    const invLimit = await getRelicInvLimitDB(userId);

    let awRelicId: number;
    let awGrade: RelicGrade;
    let awTypeId: number;

    if (!isNaN(awIdRaw)) {
      const { rows: awRows } = await pool.query(
        `SELECT relic_id, type_id, grade, effect_value FROM relics WHERE relic_id = $1 AND owner_id = $2`,
        [awIdRaw, userId]
      );
      if (!awRows.length) {
        return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 유물을 찾을 수 없어요`), card({ title: "❌ 유물을 찾을 수 없어요", description: `ID ${awIdRaw}번 유물이 없어요.`, buttons: [RELIC_BTN_STORAGE] })], { u: { type: "botUserKey", id: userId } }));
      }
      awRelicId = awIdRaw;
      awGrade   = Number(awRows[0].grade) as RelicGrade;
      awTypeId  = Number(awRows[0].type_id);
    } else {
      const inventory = await getUserInventory(userId, invLimit);
      const main      = inventory.mainRelic;
      if (!main) {
        return res.json(multiOutput(
          [
            mentionText(`❌ {{#mentions.u}} 메인 유물이 없어요`),
            card({
              title: "❌ 메인 유물이 없어요",
              description: "먼저 유물을 획득하고 메인으로 설정해주세요.\n또는: @초능력자 유물각성 [유물ID]",
              buttons: [RELIC_BTN_INFO],
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
      awRelicId = main.relicId;
      awGrade   = main.grade as RelicGrade;
      awTypeId  = main.typeId;
    }

    // effectValue / level / enhance 조회
    const { rows: awEv } = await pool.query(
      `SELECT effect_value, level, enhance FROM relics WHERE relic_id = $1`, [awRelicId]
    );
    const awEffectValue = awEv.length ? Number(awEv[0].effect_value) : 0;
    const awLevel       = awEv.length ? Number(awEv[0].level ?? 1) : 1;
    const awEnhance     = awEv.length ? Number(awEv[0].enhance ?? 0) : 0;

    const grade = awGrade;
    if (grade < 4) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 각성 불가`),
          card({
            title: "❌ 각성 불가",
            description: [
              `각성은 A·S등급(4·5등급) 유물만 가능해요.`,
              `현재 등급: ${GRADE_STARS[grade]} [${GRADE_NAMES[grade]}]`,
              ``,
              `유물합성으로 등급을 올려주세요!`,
            ].join("\n"),
            buttons: [RELIC_BTN_FUSE, RELIC_BTN_INFO],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // 각성 등급 전용 특수 효과 안내
    const gradeName  = GRADE_NAMES[grade];
    const starSymbol = GRADE_STARS[grade];
    const effectPct  = awEffectValue.toFixed(1);
    const typeInfo   = RELIC_TYPE_CATALOG.find(t => t.typeId === awTypeId);
    // effectType별 각성/초월 고유 설명
    const effectTypeDesc: Record<string, string> = {
      all_bonus:            `모든 게임 포인트 +${effectPct}% 증폭`,
      chosung_bonus:        `초성퀴즈 포인트 +${effectPct}% 증폭`,
      hunmin_bonus:         `훈민정음 포인트 +${effectPct}% 증폭`,
      jamo_bonus:           `자모연성 포인트 +${effectPct}% 증폭`,
      combo_bonus:          `연속정답 보너스 +${effectPct}% 추가 증폭`,
      enhance_cost_reduce:  `강화 비용 ${effectPct}% 절감`,
      storage_bonus:        `보관함 유물 효과 +${effectPct}% 강화`,
    };
    const effectTypeKey = typeInfo?.effectType ?? '';
    const effectSpecificDesc = effectTypeDesc[effectTypeKey] ?? `효과량 ${effectPct}%`;
    const awakeLine  = grade === 4
      ? `🟣 각성 패시브: ${effectSpecificDesc}`
      : `🟡 초월 해방: ${effectSpecificDesc} (1.5배 증폭 적용)`;
    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 님의 각성 유물 | [${gradeName}] ${typeInfo?.typeName ?? "알 수 없음"} Lv.${awLevel} · +${awEnhance}강 | 효과 +${effectPct}%`),
        card({
          title: `${starSymbol} ${gradeName} 유물 각성 현황`,
          description: [
            `[${gradeName}] ${typeInfo?.typeName ?? "알 수 없음"}`,
            `Lv.${awLevel} · +${awEnhance}강 · ID: ${awRelicId}`,
            `효과 유형: ${typeInfo?.description ?? ""} +${effectPct}%`,
            ``,
            awakeLine,
            ``,
            `💡 각성/초월 유물의 효과는 자동으로 게임에 적용됩니다.`,
            `유물합성으로 S등급에 도전해보세요!`,
          ].join("\n"),
          buttons: grade < 5
            ? [RELIC_BTN_FUSE, RELIC_BTN_UPGRADE, RELIC_BTN_INFO]
            : [RELIC_BTN_UPGRADE, RELIC_BTN_INFO],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 유물 뽑기 ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (utterance === "유물뽑기" || utterance === "유물 뽑기") {
    const GACHA_COST = 3000;
    const score = getUserScore(userId)?.score ?? 0;
    if (score < GACHA_COST) {
      return res.json(multiOutput(
        [
          mentionText(`❌ {{#mentions.u}} 포인트가 부족해요`),
          card({
            title: "❌ 포인트가 부족해요",
            description: `유물 뽑기 비용: ${fmt(GACHA_COST)}P\n현재 포인트: ${fmt(score)}P`,
            buttons: [
              { action: "message", label: "초성퀴즈", messageText: "@초능력자 초성퀴즈" },
              RELIC_BTN_INFO,
            ],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    const invLimit = await getRelicInvLimitDB(userId);
    const count    = await getRelicCount(userId);
    if (count >= invLimit) {
      return res.json(multiOutput(
        [
          mentionText(`📦 {{#mentions.u}} 보관함이 가득 찼어요`),
          card({
            title: "📦 보관함이 가득 찼어요",
            description: `보관함: ${count}/${invLimit}칸\n유물을 판매하거나 보관함을 확장해주세요.`,
            buttons: [RELIC_BTN_STORAGE, RELIC_BTN_EXPAND],
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }
    // 뽑기 전 메인 유물 여부 확인 (자동 등록 판단용)
    const hadMainBefore = (await getUserInventory(userId, invLimit)).mainRelic !== null;

    const balanceBefore = getUserScore(userId)?.score ?? 0;
    const deductOk = deductFragments(userId, nickname, GACHA_COST);
    if (!deductOk) {
      return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 포인트 차감 실패`), card({ title: "❌ 포인트 차감 실패", description: "잠시 후 다시 시도해주세요." })], { u: { type: "botUserKey", id: userId } }));
    }
    const balanceAfter = getUserScore(userId)?.score ?? (balanceBefore - GACHA_COST);

    // 포인트 로그 기록 (fire-and-forget)
    pool.query(
      `INSERT INTO artifact_point_log (user_id, change_amount, change_type, reason, balance_before, balance_after)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, -GACHA_COST, 'spend', 'gacha', balanceBefore, balanceAfter],
    ).catch((err: unknown) => { req.log.error({ err }, '[gacha] point_log INSERT 실패'); });

    // 확정 뽑기: 가중치 100% 기반 등급 선택 → 항상 1개 지급
    const dropped = await createGachaRelic(userId);
    const droppedGrade    = dropped.grade as 1|2|3|4|5;
    const droppedTypeDef  = RELIC_TYPE_CATALOG.find(t => t.typeId === dropped.typeId);
    const droppedName     = getRelicName(dropped.typeId, droppedGrade);

    // 메인 유물이 없었으면 자동 등록
    let autoSetMain = false;
    if (!hadMainBefore) {
      autoSetMain = await setMainRelic(userId, dropped.relicId);
    }

    logRelicEvent(nickname, '뽑기', `${GRADE_STARS[droppedGrade]}${GRADE_NAMES[droppedGrade]} ${droppedName}`);
    return res.json(multiOutput(
      [
        mentionText(`🎊 {{#mentions.u}} 님 유물 뽑기! ${GRADE_STARS[droppedGrade]} [${GRADE_NAMES[droppedGrade]}] ${droppedName} Lv.1 · 0강 | ${droppedTypeDef?.description ?? ""} +${dropped.effectValue.toFixed(1)}%`),
        basicCard({
          title: `🎊 유물 뽑기 결과`,
          description: [
            `${GRADE_STARS[droppedGrade]} [${GRADE_NAMES[droppedGrade]}] ${droppedName}`,
            `Lv.1 · 0강 · ID: ${dropped.relicId}`,
            `효과: ${droppedTypeDef?.description ?? ""} +${dropped.effectValue.toFixed(1)}%`,
            ``,
            `🔮 -${fmt(GACHA_COST)}P 차감 | 잔여: ${fmt(balanceAfter)}P`,
            autoSetMain ? `🏛️ 메인 유물로 자동 등록되었어요!` : `보관함에서 확인 후 메인으로 설정해보세요!`,
            ``,
            `유물이 모이면 합성으로 높은 등급으로 성장할 수 있어요!`,
          ].join("\n"),
          imageUrl: getNewRelicImageUrl(dropped.typeId, droppedGrade),
          buttons: [RELIC_BTN_GACHA, RELIC_BTN_UPGRADE],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }


  // ══════════════════════════════════════════════════════════════════════
  // ── 배틀 ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (utterance === "배틀" || utterance.startsWith("배틀 ")) {
    const todayKST = (() => {
      const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    const usedToday  = await getDailyBattleCount(userId, todayKST);
    const remaining  = BATTLE_CONFIG.daily_limit - usedToday;
    const targetNick = utterance === "배틀" ? "" : utterance.slice("배틀 ".length).trim();

    // ── 현황 조회 ──────────────────────────────────────────────────────
    if (!targetNick) {
      const myPowerStats = await calculateEffectiveBattlePower(userId);

      const battleStatusBtns: KakaoButton[] = [
        { action: "message", label: "내 유물", messageText: "@초능력자 내유물" },
        { action: "message", label: "배틀",    messageText: "@초능력자 배틀" },
      ];
      return res.json(multiOutput(
        [
          mentionText(`⚔️ {{#mentions.u}} 배틀 현황`),
          card({
            title: "⚔️ 배틀 현황",
            description: [
              `🗓 오늘 남은 배틀: ${remaining}/${BATTLE_CONFIG.daily_limit}회`,
              `🏆 승리 보상: 상대 전투력 × ${BATTLE_CONFIG.win_reward_mult}P`,
              `🔥 내 실효 전투력: ${myPowerStats.totalPower.toFixed(2)}`,
              `  ┣ 메인: ${myPowerStats.mainPower.toFixed(2)}`,
              `  ┗ 보관(${Math.round(BATTLE_CONFIG.effect_weight * 100)}% 적용): ${myPowerStats.storagePowerApplied.toFixed(2)}`,
              ``,
              `사용법: 배틀 [상대닉네임]`,
            ].join("\n"),
            buttons: battleStatusBtns,
          }),
        ],
        { u: { type: "botUserKey", id: userId } },
      ));
    }

    // ── 배틀 실행 ─────────────────────────────────────────────────────
    if (remaining <= 0) {
      return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: `오늘 배틀 횟수(${BATTLE_CONFIG.daily_limit}회)를 모두 사용했어요.\n내일 다시 도전하세요!` })], { u: { type: "botUserKey", id: userId } }));
    }

    const allUsers = getRanking();
    const target   = allUsers.find(u => u.nickname === targetNick && u.userId !== userId);

    if (!target) {
      if (userId && allUsers.find(u => u.userId === userId)?.nickname === targetNick) {
        return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: "자기 자신에게는 배틀을 걸 수 없어요." })], { u: { type: "botUserKey", id: userId } }));
      }
      return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: `"${targetNick}" 닉네임의 유저를 찾을 수 없어요.\n정확한 닉네임을 입력해주세요.` })], { u: { type: "botUserKey", id: userId } }));
    }

    // 배틀 슬롯 원자적 예약 (배틀 전 호출로 한도 초과 방지)
    const countAccepted = await incrementBattleCount(userId, todayKST);
    if (!countAccepted) {
      return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: `오늘 배틀 횟수(${BATTLE_CONFIG.daily_limit}회)를 모두 사용했어요.\n내일 다시 도전하세요!` })], { u: { type: "botUserKey", id: userId } }));
    }

    const result = await conductBattle(userId, target.userId);

    if (result.won && result.winReward > 0) {
      refundPoints(userId, nickname, result.winReward);
    }

    // 승/패 결과를 battle_log에 반영
    updateBattleOutcome(userId, todayKST, result.won).catch(err =>
      logger.error({ err, userId }, "updateBattleOutcome failed")
    );
    recordBattleResult(userId, target.userId, target.nickname, todayKST, result.won, result.winReward).catch(err =>
      logger.error({ err, userId }, "recordBattleResult failed")
    );

    const remainAfter = BATTLE_CONFIG.daily_limit - (usedToday + 1);

    const resultLines = [
      `🆚 ${nickname} vs ${target.nickname}`,
      ``,
      `내 실효 전투력: ${result.myPower.toFixed(2)}`,
      `  ┣ 메인: ${result.mainPower.toFixed(2)} / 보관: ${result.storagePowerApplied.toFixed(2)}`,
      `상대 실효 전투력: ${result.oppPower.toFixed(2)}`,
      `  ┣ 메인: ${result.oppMainPower.toFixed(2)} / 보관: ${result.oppStoragePowerApplied.toFixed(2)}`,
      `승률: ${Math.round(result.winProb * 100)}%`,
      ``,
      result.won
        ? `🏆 승리! +${result.winReward.toLocaleString()}P`
        : `💀 패배...`,
      `남은 배틀: ${remainAfter}/${BATTLE_CONFIG.daily_limit}회`,
    ].join("\n");

    const battleResultBtns: KakaoButton[] = [
      { action: "message", label: "내 유물", messageText: "@초능력자 내유물" },
      { action: "message", label: "배틀",    messageText: "@초능력자 배틀" },
    ];
    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.me}} vs {{#mentions.opp}}`),
        { textCard: withLayout({
          title: result.won ? "⚔️ 배틀 승리!" : "⚔️ 배틀 패배",
          description: resultLines,
          buttons: battleResultBtns,
        }) },
      ],
      {
        me:  { type: "botUserKey", id: userId },
        opp: { type: "botUserKey", id: target.userId },
      },
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── 내정보 ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (utterance === "내정보" || utterance === "내 정보") {
    const userScore    = getUserScore(userId);
    const score        = userScore?.score ?? 0;
    const invLimit     = await getRelicInvLimitDB(userId);
    const inventory    = await getUserInventory(userId, invLimit);
    const main         = inventory.mainRelic;
    const relicCount   = await getRelicCount(userId);

    const mainRelicLine = main
      ? `${GRADE_STARS[main.grade as RelicGrade]} ${getRelicName(main.typeId, main.grade as RelicGrade)} (ID: ${main.relicId})`
      : "없음 (유물뽑기로 획득하세요!)";

    const lines = [
      `💰 포인트: ${scoreDisplay(score)}`,
      ``,
      `🏛️ 메인 유물: ${mainRelicLine}`,
      `📦 보관함: ${relicCount}/${invLimit}개`,
    ];

    return res.json(multiOutput(
      [
        mentionText(`🔮 {{#mentions.u}} 님의 내 정보`),
        card({
          title: "📋 내 정보",
          description: lines.join("\n"),
          buttons: [
            RELIC_BTN_INFO,
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 훈민정음 진행 중 — 단어 제출 처리
  {
    const hunmin = getHunminSession(roomId);
    if (hunmin) {
      await handleHunminSubmit(hunmin, roomId, userId, nickname, utterance, res);
      return;
    }
  }

  // 활성 세션 — 정답 처리 (초성퀴즈, ended 세션은 제외)
  const session = getSession(roomId);
  if (session && !session.ended) {
    const quiz = getCurrentQuiz(session);
    if (quiz) {
      session.lastActivityAt = new Date();
      resetSessionTimer(roomId);

      if (checkAnswer(quiz, utterance)) {
        if (session.lastCreditedQuizId === quiz.id) {
          return res.json(multiOutput([mentionText(`✅ {{#mentions.u}} 이미 처리된 정답이에요.`), card({ title: "✅ 이미 처리된 정답이에요.", description: "다음 문제를 풀어볼까요?" })], { u: { type: "botUserKey", id: userId } }));
        }
        session.lastCreditedQuizId = quiz.id;
        const basePts = session.currentPts;
        const reward = await computeReward(userId, basePts, 'chosung', true);

        // ── 유물 효과 적용 (초성 보너스 + 전체 보너스 + 콤보 보너스) ──
        const relicFx = await getRelicEffectsDetailed(userId, ['chosung_bonus', 'all_bonus', 'combo_bonus']);
        const relicPct = relicFx.effects.chosungBonus + relicFx.effects.allBonus + relicFx.effects.comboBonus;
        const relicBonus = relicPct > 0 ? Math.round(reward.finalReward * relicPct / 100) : 0;
        const pts = reward.finalReward + relicBonus;

        session.correct += 1;
        session.total += 1;
        incrementQuizAttempt(quiz.id);
        incrementQuizCorrect(quiz.id);
        recordScore(userId, nickname, pts, 'earn_chosung');
        recordRoomScore(roomId, userId, nickname, pts);
        const cumTotal = getUserScore(userId)?.score ?? pts;

        const snapCorrect = session.correct; const snapTotal = session.total;
        suspendSession(roomId);
        const baseResp = correctResponse(roomId, userId, pts, cumTotal, snapCorrect, snapTotal, { comboTriggered: reward.regularComboTriggered, comboPct: reward.comboPct, basePts });
        const relicInfo = relicBreakdownLine(relicFx.mainPct, relicFx.storagePct);
        if (relicInfo && baseResp?.template?.outputs?.[0]) {
          const out = baseResp.template.outputs[0] as Record<string, { text: string }>;
          if (out.simpleText) out.simpleText.text += `\n${relicInfo}`;
        }
        return res.json(baseResp);
      } else {
        const remainMs = Math.max(0, TIMEOUT_MS - (Date.now() - session.questionStartedAt.getTime()));
        if (remainMs === 0) {
          const ans = quiz.answer;
          incrementQuizAttempt(quiz.id);
          suspendSession(roomId);
          return res.json(multiOutput(
            [
              mentionText(`⏰ {{#mentions.u}} 시간이 초과되었어요!`),
              card({
                title: "⏰ 시간이 초과되었어요!",
                description: `3분 내에 맞히지 못했어요.\n정답은 「${ans}」 이었어요.\n다시 도전해볼까요?`,
                buttons: RESTART_BTNS,
              }),
            ],
            { u: { type: "botUserKey", id: userId } },
          ));
        }
        incrementQuizAttempt(quiz.id);
        recordWrong(userId, nickname);
        const penalty = Math.floor(Math.random() * 61) + 40;
        session.currentPts = Math.max(50, session.currentPts - penalty);
        session.currentWrong += 1;
        const remaining = getRemainingTime(session.questionStartedAt);
        const pts = session.currentPts;
        const maxHints = calcMaxHints(quiz.answer);
        const hintsLeft = session.hintsUsed < maxHints;
        const hint = session.revealedKoreanIndices.length > 0
          ? buildHintDisplayRandom(quiz.answer, new Set(session.revealedKoreanIndices))
          : (session.currentWrong >= 5 ? autoRevealHint(session, quiz.answer) : undefined);
        return res.json(wrongResponse(userId, remaining, session.currentWrong, pts, hint, hintsLeft));
      }
    }
  }

  // ── 도움말 ────────────────────────────────────────────────────────────
  if (utterance === "초퀴도움말" || utterance === "초성퀴즈도움말") {
    return res.json(multiOutput([plainText(
      "🔮 초성퀴즈 도움말\n\n초성(자음)만 보고 단어를 맞히는 게임이에요!\n\n📌 기본 규칙\n• 화면에 표시된 초성을 보고 정답 단어를 입력하세요.\n• 오답을 입력하면 포인트가 조금씩 줄어요.\n• 5번 이상 틀리면 힌트가 자동으로 공개돼요.\n• 60초 안에 못 맞히면 문제가 자동 종료돼요.\n\n💰 포인트\n• 랜덤 문제: 최대 7,500P\n• 주제 선택: 최대 3,750P\n• 오답마다 포인트 감소 (최소 50P 보장)\n• 힌트 사용: 100P 차감\n\n🔥 콤보\n• 10분 내 5회 이상 정답 → 콤보 발동!\n• 60초간 모든 게임 포인트 +20%\n\n📝 명령어\n• 초성퀴즈 — 게임 시작\n• 초성퀴즈 [카테고리] — 카테고리 지정 시작\n• 초성주제 — 카테고리 목록 보기\n• 다음문제 — 다음 퀴즈로 넘어가기\n• 힌트 — 글자 하나 공개 (100P 차감)\n• 종료 — 게임 종료"
    )]));
  }

  if (utterance === "훈민도움말" || utterance === "훈민정음도움말") {
    return res.json(multiOutput([plainText(
      "📜 훈민정음 도움말\n\n초성과 글자 수 힌트로 단어를 최대한 많이 맞히는 멀티플레이 게임이에요!\n\n📌 기본 규칙\n• '훈민정음'을 입력하면 방이 열려요.\n• 25초 안에 '참여'를 입력해서 참가하세요.\n• 충분한 인원이 모이면 게임이 시작돼요.\n• 45초 동안 최대한 많은 단어를 맞혀요!\n• 이미 맞힌 단어는 다시 사용할 수 없어요.\n\n💰 포인트\n• 단어 1개 정답: 2,500P\n• 가장 많이 맞힌 MVP: +12,000P 보너스\n• 콤보 발동 중이면 전원 +20% 추가!\n\n📝 명령어\n• 훈민정음 — 방 개설\n• 참여 — 게임 참여 등록\n• 시작 — 등록 마감 후 강제 시작 (방장)\n• 힌트 — 글자 힌트 공개 (100P 차감)\n• 종료 — 게임 종료"
    )]));
  }

  if (utterance === "자모도움말" || utterance === "자모연성도움말") {
    return res.json(multiOutput([plainText(
      "🔤 자모연성 도움말\n\n흩어진 한글 자모를 보고 4개 보기 중 단어를 골라 맞히는 게임이에요!\n\n📌 기본 규칙\n• 주어진 자모 조각들로 만들 수 있는 단어를 고르세요.\n• 1, 2, 3, 4 중 하나를 입력하면 돼요.\n• 3분 안에 답하지 않으면 자동 종료돼요.\n\n💰 기본 포인트\n• 쉬움 (2글자): 1,780P\n• 보통 (3글자): 2,670P\n• 어려움 (4글자): 4,000P\n\n⭐ 추가 보너스\n• 3글자 이상 단어: +670P\n• 받침 포함 단어: +440P\n• 오늘 첫 자모연성: +1,110P\n• 연속 3회 정답: +2,220P\n\n📝 명령어\n• 자모연성 — 랜덤 난이도로 시작\n• 자모연성 쉬움 / 보통 / 어려움 — 난이도 지정\n• 1 / 2 / 3 / 4 — 보기 선택\n• 다음퀴즈 — 연속으로 다음 문제 받기\n• 자모포기 — 현재 문제 포기"
    )]));
  }

  if (utterance === "유물도움말") {
    return res.json(multiOutput([plainText(
      "🏛️ 유물 도움말\n\n유물은 게임에서 획득하는 포인트를 영구적으로 높여주는 특별 아이템이에요!\n\n⭐ 유물 등급 (낮은 → 높은)\nD → C → B → A → S → 🔴SS\n등급이 높을수록 포인트 보너스 효과가 강력해요.\nSS등급은 주 효과 외에 all_bonus가 추가로 적용돼요!\n\n🎁 유물 획득\n• 유물뽑기 — 포인트를 소비해 D등급 유물을 획득\n• 게임 승리 시 확률로 드롭\n\n⚒️ 강화 & 레벨업\n• 유물강화 — 최대 +20까지 강화 (실패 가능, 강화 1당 효과 +3%)\n• 유물레벨업 — 최대 30레벨까지 성장 (실패 없음, 레벨 1당 효과 +1%)\n  비용은 등급과 현재 레벨에 비례해 높아져요.\n💡 TIP: 레벨업은 실패가 없으니 포인트가 있다면 언제든 올려두세요!\n\n🔀 유물 합성 (2단계)\n① 유물합성 D/C/B/A/S — 재료 목록 + 성공률 확인\n② 합성진행 — 확인 후 실제 합성 실행\n• 합성제거 번호,번호 — 특정 유물을 재료에서 제거\n• 재료가 많을수록 성공률이 높아져요!\n※ S→SS 합성은 최소 3개, 최대 성공률 45%\n\n💸 유물 분해\n• 유물분해 — 유물을 분해해 포인트 일부 환급\n\n📦 유물 보관함\n• 메인 유물 외 추가 유물을 보관 (효과 약 20% 적용)\n• 유물설정 [ID] — 보관함 유물을 메인으로 교체\n\n📝 명령어\n• 내유물 — 메인 유물 확인\n• 유물보관함 — 보관함 전체 확인\n• 유물뽑기 / 유물강화 / 유물레벨업\n• 유물합성 / 유물분해 / 유물설정 [ID]"
    )]));
  }

  // ── 게임하기 ──────────────────────────────────────────────────────────
  if (utterance === "게임하기") {
    return res.json(multiOutput(
      [
        mentionText(`🎮 {{#mentions.u}} 님, 어떤 게임을 하시겠습니까?`),
        card({
          description: "아래 버튼에서 원하는 게임을 선택해 주세요!",
          buttons: [
            { action: "message", label: "초성퀴즈",  messageText: "@초능력자 초성퀴즈" },
            { action: "message", label: "훈민정음",  messageText: "@초능력자 훈민정음" },
            { action: "message", label: "자모연성",  messageText: "@초능력자 자모연성" },
          ],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  // 게임 없음 — 메뉴
  return res.json(multiOutput(
    [
      mentionText(`🔮 {{#mentions.u}} 안녕하세요 초능력자예요!`),
      card({
        description: "🔮 안녕하세요 초능력자예요!\n게임을 통해 능력자로 발돋움해요.",
        buttons: [
          { action: "message", label: "게임하기", messageText: "@초능력자 게임하기" },
          { action: "message", label: "프로필",  messageText: "@초능력자 프로필" },
          { action: "guide",   label: "도움말" },
        ],
      }),
    ],
    { u: { type: "botUserKey", id: userId } },
    [{ label: "랭킹", action: "message", messageText: "@초능력자 랭킹" }],
  ));
});

// ──────────────────────────────────────────────
// 프로필 멘션 전용 스킬 엔드포인트
// POST /api/kakao/profile
// 카카오 "프로필" 블록에서 sys.user.mention 파라미터를 받아 처리
// ──────────────────────────────────────────────
router.post("/profile", async (req: Request, res: Response) => {
  const { roomId, userId, nickname } = extractIds(req);
  await ensureUserInRankingBoard(userId, nickname, roomId);
  _activeNudge = tickNudge(userId) ? "\n혹시 출첵은 하셨나요?" : "";
  const utterance = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  // ── 디버그: 전체 action 구조 출력 ──
  logger.info({
    profile_debug: {
      utterance,
      action_params:    req.body?.action?.params,
      action_detailParams: req.body?.action?.detailParams,
      entities:         req.body?.action?.entities,
      extra:            req.body?.userRequest?.extra,
      raw_utterance:    req.body?.userRequest?.utterance,
    }
  }, "[profile] raw payload");

  // sys_user_mention 파라미터에서 botUserKey 추출
  const actionParams: Record<string, unknown> = req.body?.action?.params ?? {};
  const detailParams: Record<string, unknown> = req.body?.action?.detailParams ?? {};
  let targetId: string = userId;
  let targetNick: string = nickname;
  let viewingOther = false;

  // botUserKey 추출 헬퍼: params 또는 detailParams 값에서 추출
  function extractBotUserKey(val: unknown): string | undefined {
    try {
      // params: 직접 JSON 문자열 → { botUserKey, startIndex, endIndex }
      const direct = typeof val === "string" ? JSON.parse(val) : val as Record<string, unknown>;
      if (direct?.botUserKey) return direct.botUserKey as string;
      if (direct?.appUserId) return direct.appUserId as string;
      // detailParams: { groupName, origin, value: "JSON문자열" }
      if (typeof direct?.value === "string") {
        const inner = JSON.parse(direct.value as string);
        if (inner?.botUserKey) return inner.botUserKey as string;
        if (inner?.appUserId) return inner.appUserId as string;
      }
    } catch { /* 무시 */ }
    return undefined;
  }

  // detailParams 우선, 그 다음 params
  let mentionedKey: string | undefined;
  for (const [key, val] of Object.entries(detailParams)) {
    if (key.startsWith("sys_user_mention")) {
      mentionedKey = extractBotUserKey(val);
      if (mentionedKey) break;
    }
  }
  if (!mentionedKey) {
    for (const [key, val] of Object.entries(actionParams)) {
      if (key.startsWith("sys_user_mention")) {
        mentionedKey = extractBotUserKey(val);
        if (mentionedKey) break;
      }
    }
  }

  logger.info({ mentionedKey, userId }, "[profile] extracted mention key");

  if (mentionedKey) {
    // 자기 자신 멘션도 허용 (candidate === userId 이면 내 프로필)
    targetId = mentionedKey;
    // DB에 없으면 50P로 자동 등록
    const ensured = await ensureUserInRankingBoard(mentionedKey, undefined, roomId);
    targetNick = ensured.nickname;
    viewingOther = mentionedKey !== userId;
  }

  // 파라미터가 없으면 utterance에서 닉네임으로 검색
  if (!mentionedKey) {
    const rawText = utterance.replace(/^프로필\s*/, "").replace(/^@/, "").trim();
    if (rawText) {
      const allUsers = getRanking();
      const found = allUsers.find(
        (u) => u.nickname === rawText || u.nickname.includes(rawText)
      );
      if (found) {
        targetId = found.userId;
        targetNick = found.nickname;
        viewingOther = true;
      } else {
        return res.json(multiOutput(
          [
            mentionText(`❓ {{#mentions.u}} 사용자를 찾을 수 없어요`),
            card({
              title: "❓ 사용자를 찾을 수 없어요",
              description: `@${rawText} 님의 기록이 없어요.\n아직 게임을 한 번도 하지 않은 사용자예요.\n상대방이 먼저 게임을 플레이해야 정보가 생겨요!`,
              buttons: RESTART_BTNS,
            }),
          ],
          { u: { type: "botUserKey", id: userId } },
        ));
      }
    }
  }

  let global       = getUserScore(targetId);
  // 메모리에 없으면 DB에서 직접 조회
  if (!global) {
    try {
      const row = await pool.query(
        "SELECT nickname, score, correct, total, hunmin_wins, hunmin_max, hunmin_total FROM users WHERE user_id = $1",
        [targetId]
      );
      if (row.rows[0]) {
        const r = row.rows[0];
        global = { userId: targetId, nickname: r.nickname, score: Number(r.score), correct: Number(r.correct), total: Number(r.total), hunminWins: Number(r.hunmin_wins ?? 0), hunminMax: Number(r.hunmin_max ?? 0), hunminTotal: Number(r.hunmin_total ?? 0) } as any;
        targetNick = r.nickname; // DB 닉네임 우선
      }
    } catch { /* 무시 */ }
  }
  const attended     = hasAttendedToday(targetId);

  const profileRanking2      = getRanking();
  const profileRankIdx2      = profileRanking2.findIndex((u) => u.userId === targetId);
  const profileScore2        = global?.score ?? 0;
  const globalRankLine2      = spServerRankLine(targetId) || "🌟 초능력자 순위 : 집계 중...";
  const roomRankDisp2        = spRoomRankLine(targetId, roomId) || "🌟 방 초능력자 순위 : 집계 중...";
  const pointRankLine2       = profileRankIdx2 >= 0 ? `💎 포인트 전체 순위 : ${profileRankIdx2 + 1}위` : "💎 포인트 전체 순위 : 순위 없음";

  const targetInvLimit2   = await getRelicInvLimitDB(targetId);
  const targetInventory2  = await getUserInventory(targetId, targetInvLimit2);
  const profileMainRelic2 = targetInventory2.mainRelic;
  const profileRelicLine2 = profileMainRelic2
    ? `${GRADE_STARS[profileMainRelic2.grade]} [${GRADE_NAMES[profileMainRelic2.grade]}] ${getRelicName(profileMainRelic2.typeId, profileMainRelic2.grade)} — ${profileMainRelic2.enhance}강 | +${profileMainRelic2.effectValue}%`
    : `없음 (유물뽑기로 획득하세요!)`;

  // 초능력자 지표 조회
  const profilePowerStats2 = await calculateEffectiveBattlePower(targetId);
  const profileRelicAsset2 = await getUserRelicAssetValue(targetId);
  // 순위 계산과 동일한 함수 사용 → 카드의 "점수"와 "n-1위까지 n점 남음" gap이 일치
  const profileSuperpowerScore2 = getSpScore(targetId);

  const profileWebUrl2 = `${PROFILE_BASE_URL}/profile?uid=${encodeURIComponent(targetId)}`;
  const detailBtn2: KakaoButton = { action: "webLink", label: "🔍 자세히 보기", webLinkUrl: profileWebUrl2 };

  const profileCardLines2 = [
    `• 닉네임 : ${targetNick}`,
    `• 칭호 : ${getScoreTitle(calcTopPct(profileRankIdx2, profileRanking2.length))}`,
    `• 포인트 : ${fmt(global?.score ?? 0)}P`,
    ``,
    `🌟 초능력자 점수 : ${fmt(profileSuperpowerScore2)}점`,
    `🏺 유물 자산 : ${fmt(profileRelicAsset2)}P`,
    `⚔️ 전투력 : ${profilePowerStats2.totalPower.toFixed(2)}`,
    ``,
    globalRankLine2,
    ...(roomRankDisp2 ? [roomRankDisp2] : []),
    pointRankLine2,
    ``,
    `• 유물 : ${profileRelicLine2}`,
  ];

  if (viewingOther) {
    return res.json(multiOutput(
      [
        mentionText(`{{#mentions.target}} 님의 초능력자 정보에요!`),
        card({
          description: [
            ...profileCardLines2,
            ``,
            `• 오늘의 출석 : ${attended ? "✅ 완료" : "❌ 미완료"}`,
          ].join("\n"),
          buttons: [detailBtn2],
        }),
      ],
      { target: { type: "botUserKey", id: targetId } }
    ));
  }

  const myRelicBtn2: KakaoButton = { action: "message", label: "내 유물", messageText: "@초능력자 내유물" };
  const attendBtn2:  KakaoButton = { action: "message", label: "출첵",   messageText: "@초능력자 출첵" };

  return res.json(multiOutput(
    [
      mentionText(`{{#mentions.me}} 님의 초능력자 정보에요!`),
      card({
        description: [
          ...profileCardLines2,
          ``,
          `• 오늘의 출석 : ${attended ? "✅ 완료" : "❌ 미완료"}`,
        ].join("\n"),
        buttons: [detailBtn2, myRelicBtn2, attendBtn2],
      }),
    ],
    { me: { type: "botUserKey", id: userId } }
  ));
});

// ──────────────────────────────────────────────
// 서버 랭킹 공개 API (웹 페이지용)
// GET /api/kakao/server-ranking
// ──────────────────────────────────────────────
router.get("/server-ranking", (_req: Request, res: Response) => {
  const ranking = getRanking().slice(0, 5).map((u, i) => ({
    rank: i + 1,
    nickname: u.nickname,
    score: u.score,
  }));
  res.json({ ranking });
});

// GET /api/kakao/full-ranking
// 전체 랭킹 (웹 랭킹 페이지용)
router.get("/full-ranking", (_req: Request, res: Response) => {
  const ranking = getRanking().map((u, i) => ({
    rank: i + 1,
    userId: u.userId,
    nickname: u.nickname,
    score: u.score,
  }));
  res.json({ ranking, updatedAt: new Date().toISOString() });
});

// GET /api/kakao/relic-ranking
// 유물·통합 랭킹 배율 — 환경변수로 덮어쓰기 가능, 관리자 명령어로 런타임 조정 가능
// 유물 점수 = effectSum×COMBINED_A + relicPower×COMBINED_B
// 통합 점수 = 포인트 + effectSum×COMBINED_A + relicPower×COMBINED_B
function parseWeight(envVal: string | undefined, defaultVal: number): number {
  const n = Number(envVal);
  if (envVal !== undefined && (!Number.isFinite(n) || n < 0)) {
    logger.warn({ envVal, defaultVal }, "COMBINED_WEIGHT env value invalid, using default");
    return defaultVal;
  }
  return Number.isFinite(n) ? n : defaultVal;
}
let COMBINED_A: number = parseWeight(process.env.COMBINED_EFFECT_WEIGHT, 1400);
let COMBINED_B: number = parseWeight(process.env.COMBINED_POWER_WEIGHT,  15.6);

// GET /api/kakao/relic-ranking
// 실효 전투력(메인+보관 스택 적용) 기준 랭킹 (웹 랭킹 페이지용)
router.get("/relic-ranking", async (_req: Request, res: Response) => {
  const users    = getRanking();
  const powerMap = await getAllEffectiveBattlePowers();

  const ranking = users
    .map(u => {
      const stats = powerMap.get(u.userId);
      return {
        userId:              u.userId,
        nickname:            u.nickname,
        totalPower:          stats?.totalPower          ?? 0,
        mainPower:           stats?.mainPower           ?? 0,
        storagePowerApplied: stats?.storagePowerApplied ?? 0,
      };
    })
    .filter(u => u.totalPower > 0)
    .sort((a, b) => b.totalPower - a.totalPower)
    .map((u, i) => ({ rank: i + 1, ...u }));

  res.json({ ranking, updatedAt: new Date().toISOString() });
});

// GET /api/kakao/combined-ranking
// 포인트 + 유물효과합산 × COMBINED_A + 유물전투력 × COMBINED_B 절대값 통합 랭킹 (웹 랭킹 페이지용)
// 배율 근거: production DB 기준, 최대 유물 기여도 ≈ 포인트 1위의 25% (A=1400, B=15.6)
router.get("/combined-ranking", async (_req: Request, res: Response) => {
  const users    = getRanking();
  const statsMap = await getAllUserRelicPowers();

  const ranking = users
    .map(u => {
      const stats      = statsMap.get(u.userId);
      const relicPower = stats?.relicPower ?? 0;
      const effectSum  = stats?.effectSum  ?? 0;
      const combined   = Math.round(u.score + effectSum * COMBINED_A + relicPower * COMBINED_B);
      return {
        userId:        u.userId,
        nickname:      u.nickname,
        score:         u.score,
        relicPower,
        effectSum,
        combinedScore: combined,
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map((d, i) => ({ rank: i + 1, ...d }));

  res.json({ ranking, updatedAt: new Date().toISOString() });
});

// GET /api/kakao/superpower-ranking
// 초능력자 종합 순위 = 포인트 + 유물자산가치 + log10(1+전투력)×K
// K는 RANKING_BATTLE_POWER_LOG_WEIGHT 환경변수로 조정 (기본 100_000)
let RANKING_LOG_K: number = (() => {
  const n = Number(process.env.RANKING_BATTLE_POWER_LOG_WEIGHT);
  return Number.isFinite(n) && n >= 0 ? n : 100_000;
})();

// ── Stale-While-Revalidate 캐시 (60초 TTL) ──────────────────────────────
const RANK_CACHE_TTL = 60_000;

type SpRankEntry = {
  rank: number; userId: string; nickname: string;
  superpowerScore: number; pointScore: number;
  relicAssetScore: number; battlePowerBonus: number;
  totalPower: number; mainPower: number; storagePowerApplied: number;
};
type AssetRankEntry = {
  rank: number; userId: string; nickname: string;
  relicAssetScore: number; relicCount: number; topRelicGrade: number;
};

interface RCache<T> { data: T; updatedAt: string; expiresAt: number; refreshing: boolean; }
let _spRankCache:    RCache<SpRankEntry[]>    | null = null;
let _assetRankCache: RCache<AssetRankEntry[]> | null = null;

async function _buildSpRanking(): Promise<{ ranking: SpRankEntry[]; updatedAt: string }> {
  const users = getRanking();
  const [assetMap, powerMap] = await Promise.all([
    getAllUserRelicAssets(),
    getAllEffectiveBattlePowers(),
  ]);
  const ranking = users
    .map(u => {
      const relicAssetScore  = assetMap.get(u.userId) ?? 0;
      const powerStats       = powerMap.get(u.userId);
      const totalPower       = powerStats?.totalPower ?? 0;
      const battlePowerBonus = Math.round(RANKING_LOG_K * Math.log10(1 + totalPower));
      const superpowerScore  = u.score + relicAssetScore + battlePowerBonus;
      return { userId: u.userId, nickname: u.nickname, superpowerScore, pointScore: u.score, relicAssetScore, battlePowerBonus, totalPower, mainPower: powerStats?.mainPower ?? 0, storagePowerApplied: powerStats?.storagePowerApplied ?? 0 };
    })
    .sort((a, b) => b.superpowerScore - a.superpowerScore)
    .map((u, i) => ({ rank: i + 1, ...u }));
  return { ranking, updatedAt: new Date().toISOString() };
}

async function _buildAssetRanking(): Promise<{ ranking: AssetRankEntry[]; updatedAt: string }> {
  const users    = getRanking();
  const assetMap = await getAllUserRelicAssets();
  const { rows: relicRows } = await pool.query<{ owner_id: string; relic_count: string; top_grade: string }>(
    `SELECT owner_id, COUNT(*) AS relic_count, MAX(grade) AS top_grade FROM relics GROUP BY owner_id`,
  );
  const relicInfoMap = new Map(relicRows.map(r => [r.owner_id, { relicCount: Number(r.relic_count), topRelicGrade: Number(r.top_grade) }]));
  const ranking = users
    .map(u => {
      const relicAssetScore = assetMap.get(u.userId) ?? 0;
      const info = relicInfoMap.get(u.userId);
      return { userId: u.userId, nickname: u.nickname, relicAssetScore, relicCount: info?.relicCount ?? 0, topRelicGrade: info?.topRelicGrade ?? 1 };
    })
    .filter(u => u.relicAssetScore > 0)
    .sort((a, b) => b.relicAssetScore - a.relicAssetScore)
    .map((u, i) => ({ rank: i + 1, ...u }));
  return { ranking, updatedAt: new Date().toISOString() };
}

function _swr<T>(
  cache: RCache<T> | null,
  setCache: (c: RCache<T>) => void,
  build: () => Promise<{ ranking: T; updatedAt: string }>,
): Promise<{ ranking: T; updatedAt: string }> {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return Promise.resolve({ ranking: cache.data, updatedAt: cache.updatedAt });
  }
  if (cache && !cache.refreshing) {
    cache.refreshing = true;
    build()
      .then(r => setCache({ data: r.ranking, updatedAt: r.updatedAt, expiresAt: Date.now() + RANK_CACHE_TTL, refreshing: false }))
      .catch(() => { if (cache) cache.refreshing = false; });
    return Promise.resolve({ ranking: cache.data, updatedAt: cache.updatedAt });
  }
  return build().then(r => {
    setCache({ data: r.ranking, updatedAt: r.updatedAt, expiresAt: Date.now() + RANK_CACHE_TTL, refreshing: false });
    return r;
  });
}

router.get("/superpower-ranking", async (_req: Request, res: Response) => {
  const { ranking, updatedAt } = await _swr(
    _spRankCache,
    c => { _spRankCache = c; },
    _buildSpRanking,
  );
  res.json({ ranking, updatedAt });
});

// GET /api/kakao/relic-asset-ranking
// 유물 자산가치(투자 포인트 누적) 기준 랭킹 — SWR 캐시 적용
router.get("/relic-asset-ranking", async (_req: Request, res: Response) => {
  const { ranking, updatedAt } = await _swr(
    _assetRankCache,
    c => { _assetRankCache = c; },
    _buildAssetRanking,
  );
  res.json({ ranking, updatedAt });
});

// GET /api/kakao/categories
// 초성퀴즈 카테고리 목록 (웹사이트 실시간 표시용)
router.get("/categories", (_req: Request, res: Response) => {
  const cats = getQuizCategories();
  res.json({ categories: cats, count: cats.length });
});

// ── 선물 공통 처리 ──────────────────────────────
async function handleGift(req: Request, res: Response) {
  const { userId, nickname, roomId } = extractIds(req);
  await ensureUserInRankingBoard(userId, nickname, roomId);
  const raw = cleanUtterance(req.body?.userRequest?.utterance ?? "");
  const rest = raw.replace(/^선물\s*/, "").trim();
  // (.+) 으로 공백 포함 닉네임(예: "미나 mina")도 처리, 숫자는 끝에서 추출
  const match = rest.match(/^@?(.+)\s+(\d+)$/);
  if (!match) {
    return res.json(multiOutput(
      [
        mentionText(
          `🎁 {{#mentions.me}}님의 포인트를 선물할 수 있어요!\n선물할 분과 포인트를 함께 입력해요.\n\nex.\n/선물 @이름 300`
        ),
      ],
      { me: { type: "botUserKey", id: userId } }
    ));
  }
  const targetNick = match[1].trim();
  const amount = parseInt(match[2], 10);

  // ── 프로필과 동일한 3단계 멘션 추출 ──────────────
  const entities: any[] = req.body?.userRequest?.entities ?? [];
  const mentionEntities = entities.filter((e: any) => e.type === "mention");
  const mentionEnt = mentionEntities.length > 1 ? mentionEntities[1] : mentionEntities[0];

  const extraMentions: any[] =
    req.body?.userRequest?.extra?.mentions ?? req.body?.extra?.mentions ?? [];
  const extraMent = extraMentions.find(
    (m: any) => (m.id ?? m.userId ?? m.value) && (m.id ?? m.userId ?? m.value) !== userId
  );

  const actionParams: Record<string, string> = req.body?.action?.params ?? {};
  let sysUserMentionId: string | undefined;
  for (const [key, val] of Object.entries(actionParams)) {
    if (key.startsWith("sys_user_mention")) {
      try {
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        const candidate: string | undefined = parsed?.botUserKey ?? parsed?.appUserId;
        if (candidate && candidate !== userId) { sysUserMentionId = candidate; break; }
      } catch { /* ignore */ }
    }
  }

  const extractedId: string | undefined =
    sysUserMentionId ||
    mentionEnt?.value || mentionEnt?.userId || mentionEnt?.id ||
    extraMent?.id || extraMent?.userId || extraMent?.value;

  // 자기 자신에게 선물 시도 — DB 조회 전에 먼저 차단
  if (extractedId && extractedId === userId) {
    return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 선물 불가`), card({ title: "❌ 선물 불가", description: "자신에게는 선물할 수 없어요.", buttons: [] })], { u: { type: "botUserKey", id: userId } }));
  }

  // 카카오가 멘션을 "사용자N"으로 익명화 + 실제 ID도 못 받은 경우
  if (/^사용자\d+$/.test(targetNick) && !extractedId) {
    return res.json(multiOutput(
      [mentionText("{{#mentions.me}} 선물할 대상이 없어요")],
      { me: { type: "botUserKey", id: userId } }
    ));
  }

  if (amount <= 0) {
    return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 잘못된 수량`), card({ title: "❌ 잘못된 수량", description: `1P 이상 입력해주세요.`, buttons: [] })], { u: { type: "botUserKey", id: userId } }));
  }

  // extractedId가 있으면 ID 우선, 없으면 닉네임으로 검색
  let target = extractedId
    ? getRanking().find((u) => u.userId === extractedId)
    : getRanking().find((u) => u.nickname === targetNick);

  // extractedId가 있으면 자동 등록(50P) 후 target 확정
  if (!target && extractedId) {
    target = await ensureUserInRankingBoard(extractedId, undefined, roomId);
  }

  if (!target) {
    return res.json(multiOutput(
      [mentionText("{{#mentions.me}} 선물할 대상이 없어요")],
      { me: { type: "botUserKey", id: userId } }
    ));
  }
  const result = sendGiftFragments(userId, nickname, target.userId, amount);
  if (result === "self") {
    return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 선물 불가`), card({ title: "❌ 선물 불가", description: "자신에게는 선물할 수 없어요.", buttons: [] })], { u: { type: "botUserKey", id: userId } }));
  }
  if (result === "over_limit_count") {
    return res.json(multiOutput(
      [
        mentionText(`❌ {{#mentions.u}} 오늘 선물 횟수를 모두 사용했어요`),
        card({
          title: "❌ 오늘 선물 횟수를 모두 사용했어요",
          description: [
            `선물은 하루 ${GIFT_DAILY_LIMIT}회까지 가능해요.`,
            `매일 자정에 초기화돼요.`,
          ].join("\n"),
          buttons: [],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }
  if (result === "over_limit_frags") {
    const leftFrag = getRemainingGiftFragments(userId);
    return res.json(multiOutput(
      [
        mentionText(`❌ {{#mentions.u}} 오늘 선물 포인트 한도 초과`),
        card({
          title: "❌ 오늘 선물 포인트 한도 초과",
          description: [
            `하루 최대 ${fmt(GIFT_DAILY_MAX)}P까지 선물할 수 있어요.`,
            `오늘 남은 선물 포인트 : ${fmt(leftFrag)}P`,
            `매일 자정에 초기화돼요.`,
          ].join("\n"),
          buttons: [],
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }
  if (result === "no_funds") {
    return res.json(multiOutput([mentionText(`❌ {{#mentions.u}} 포인트 부족`), card({ title: "❌ 포인트 부족", description: `${fmt(amount)}P가 필요하지만 포인트가 부족해요.`, buttons: [] })], { u: { type: "botUserKey", id: userId } }));
  }
  if (result === "no_target") {
    return res.json(multiOutput(
      [mentionText("{{#mentions.me}} 선물할 대상이 없어요")],
      { me: { type: "botUserKey", id: userId } }
    ));
  }
  // success
  const remainCount = getRemainingGiftCount(userId);
  const remainFrags = getRemainingGiftFragments(userId);
  return res.json(multiOutput(
    [
      mentionText(`{{#mentions.sender}} → {{#mentions.recv}} 🎁 ${fmt(amount)}P 선물!`),
      card({
        title: "🎁 포인트 선물 완료!",
        description: [
          `보낸 이 : ${nickname}`,
          `받은 이 : ${target.nickname}`,
          `수량 : ${fmt(amount)}P`,
          ``,
          `오늘 남은 선물 횟수 : ${remainCount}회`,
          `오늘 남은 선물 포인트 : ${fmt(remainFrags)}P`,
        ].join("\n"),
        buttons: [],
      }),
    ],
    { sender: { type: "botUserKey", id: userId }, recv: { type: "botUserKey", id: target.userId } }
  ));
}

// POST /api/kakao/gift  (카카오빌더 스킬 블록 전용)
router.post("/gift", async (req: Request, res: Response) => {
  // [DEBUG] 실제 카카오 페이로드 구조 확인용 — 추후 삭제
  req.log.info({
    sender_userId: req.body?.userRequest?.user?.id,
    utterance: req.body?.userRequest?.utterance,
    action_params: req.body?.action?.params,
    entities: req.body?.userRequest?.entities,
    extra_mentions: req.body?.userRequest?.extra?.mentions ?? req.body?.extra?.mentions,
  }, "[GIFT DEBUG] raw payload");
  await handleGift(req, res);
});

// ──────────────────────────────────────────────
// POST /api/kakao/battle
// "배틀" → 오늘의 배틀 현황 카드
// "배틀 [닉네임]" → 상대와 배틀 실행 후 결과 카드
// ──────────────────────────────────────────────

const GRADE_NAMES_BATTLE = ["D", "C", "B", "A", "S"] as const;

router.post("/battle", async (req: Request, res: Response) => {
  const userId: string   = req.body?.userRequest?.user?.id ?? "unknown_user";
  const nickname: string =
    req.body?.userRequest?.user?.properties?.nickname ??
    req.body?.userRequest?.user?.properties?.displayName ??
    "알 수 없음";
  const utterance: string = cleanUtterance(req.body?.userRequest?.utterance ?? "");

  req.log.info({
    battle_debug: {
      raw_utterance: req.body?.userRequest?.utterance,
      clean_utterance: utterance,
      userId,
      nickname,
      action_params: req.body?.action?.params,
    }
  }, "[BATTLE DEBUG] raw payload");

  await ensureUserInRankingBoard(userId, nickname);

  const todayKST = (() => {
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // 공격자 닉네임: DB에 등록된 값 우선 (스킬블록은 user.properties를 안 보내는 경우 있음)
  const myRegistered = getUserScore(userId);
  const myNickname   = myRegistered?.nickname || nickname;

  const usedToday = await getDailyBattleCount(userId, todayKST);
  const remaining = BATTLE_CONFIG.daily_limit - usedToday;

  // action_params.sys_user_mention 에서 botUserKey 추출 (멘션 방식 우선)
  function extractMentionKey(params: Record<string, unknown>): string | undefined {
    for (const [k, v] of Object.entries(params)) {
      if (k.startsWith("sys_user_mention")) {
        try {
          const parsed = typeof v === "string" ? JSON.parse(v) : v as Record<string, unknown>;
          const key = parsed?.botUserKey as string | undefined;
          if (key && key !== userId) return key;
        } catch { /* ignore */ }
      }
    }
    return undefined;
  }
  const actionParams: Record<string, unknown> = req.body?.action?.params ?? {};
  const mentionedUserId = extractMentionKey(actionParams);

  const targetNick = utterance.replace(/^배틀\s*/, "").trim();

  // 현황 조회: 멘션도 없고 닉네임도 없을 때
  if (!mentionedUserId && !targetNick) {
    const myPowerStats = await calculateEffectiveBattlePower(userId);

    const battleStatusBtns: KakaoButton[] = [
      { action: "message", label: "내 유물", messageText: "@초능력자 내유물" },
      { action: "message", label: "배틀",    messageText: "@초능력자 배틀" },
    ];
    return res.json(multiOutput(
      [
        mentionText(`⚔️ {{#mentions.u}} 배틀 현황`),
        card({
          title: "⚔️ 배틀 현황",
          description: [
            `🗓 오늘 남은 배틀: ${remaining}/${BATTLE_CONFIG.daily_limit}회`,
            `🏆 승리 보상: 상대 전투력 × ${BATTLE_CONFIG.win_reward_mult}P`,
            `🔥 내 실효 전투력: ${myPowerStats.totalPower.toFixed(2)}`,
            `  ┣ 메인: ${myPowerStats.mainPower.toFixed(2)} / 보관: ${myPowerStats.storagePowerApplied.toFixed(2)}`,
            ``,
            `사용법: 배틀 @[상대멘션] 또는 배틀 [닉네임]`,
          ].join("\n"),
          buttons: battleStatusBtns,
        }),
      ],
      { u: { type: "botUserKey", id: userId } },
    ));
  }

  if (remaining <= 0) {
    return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: `오늘 배틀 횟수(${BATTLE_CONFIG.daily_limit}회)를 모두 사용했어요.\n내일 다시 도전하세요!` })], { u: { type: "botUserKey", id: userId } }));
  }

  const allUsers = getRanking();

  // 타겟 탐색: 멘션 botUserKey 우선 → 닉네임 텍스트 매칭 폴백
  let target = mentionedUserId
    ? allUsers.find(u => u.userId === mentionedUserId)
    : allUsers.find(u => u.nickname === targetNick && u.userId !== userId);

  if (!target) {
    return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: mentionedUserId ? "상대방이 아직 서버에 등록되지 않았어요.\n상대방이 먼저 봇과 한 번 대화해야 합니다." : `"${targetNick}" 닉네임의 유저를 찾을 수 없어요.\n정확한 닉네임을 입력해주세요.` })], { u: { type: "botUserKey", id: userId } }));
  }

  if (target.userId === userId) {
    return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: "자기 자신에게는 배틀을 걸 수 없어요." })], { u: { type: "botUserKey", id: userId } }));
  }

  // 배틀 슬롯 원자적 예약 (배틀 전 호출로 한도 초과 방지)
  const countAccepted = await incrementBattleCount(userId, todayKST);
  if (!countAccepted) {
    return res.json(multiOutput([mentionText(`⚔️ {{#mentions.u}} 배틀 불가`), card({ title: "⚔️ 배틀 불가", description: `오늘 배틀 횟수(${BATTLE_CONFIG.daily_limit}회)를 모두 사용했어요.\n내일 다시 도전하세요!` })], { u: { type: "botUserKey", id: userId } }));
  }

  const result = await conductBattle(userId, target.userId);

  if (result.won && result.winReward > 0) {
    refundPoints(userId, myNickname, result.winReward);
  }

  // 승/패 결과를 battle_log에 반영
  updateBattleOutcome(userId, todayKST, result.won).catch(err =>
    logger.error({ err, userId }, "updateBattleOutcome failed")
  );
  recordBattleResult(userId, target.userId, target.nickname, todayKST, result.won, result.winReward).catch(err =>
    logger.error({ err, userId }, "recordBattleResult failed")
  );

  const usedAfter = usedToday + 1;
  const remainAfter = BATTLE_CONFIG.daily_limit - usedAfter;

  const resultLines = [
    `🆚 ${myNickname} vs ${target.nickname}`,
    ``,
    `내 실효 전투력: ${result.myPower.toFixed(2)}`,
    `  ┣ 메인: ${result.mainPower.toFixed(2)} / 보관: ${result.storagePowerApplied.toFixed(2)}`,
    `상대 실효 전투력: ${result.oppPower.toFixed(2)}`,
    `  ┣ 메인: ${result.oppMainPower.toFixed(2)} / 보관: ${result.oppStoragePowerApplied.toFixed(2)}`,
    `승률: ${Math.round(result.winProb * 100)}%`,
    ``,
    result.won
      ? `🏆 승리! +${result.winReward.toLocaleString()}P`
      : `💀 패배...`,
    `남은 배틀: ${remainAfter}/${BATTLE_CONFIG.daily_limit}회`,
  ].join("\n");

  const battleResultBtns: KakaoButton[] = [
    { action: "message", label: "내 유물", messageText: "@초능력자 내유물" },
    { action: "message", label: "배틀",    messageText: "@초능력자 배틀" },
  ];
  return res.json(multiOutput(
    [
      mentionText(`⚔️ {{#mentions.me}} vs {{#mentions.opp}}`),
      card({
        title: result.won ? "⚔️ 배틀 승리!" : "⚔️ 배틀 패배",
        description: resultLines,
        buttons: battleResultBtns,
      }),
    ],
    {
      me:  { type: "botUserKey", id: userId },
      opp: { type: "botUserKey", id: target.userId },
    },
  ));
});

// ──────────────────────────────────────────────
// POST /api/kakao/userid
// "아이디 @멘션" → 멘션된 사람의 botUserKey를 일반 텍스트로 반환
// ──────────────────────────────────────────────
router.post("/userid", (req: Request, res: Response) => {
  function extractBotUserKey(val: unknown): string | undefined {
    try {
      const obj = typeof val === "string" ? JSON.parse(val) : val as Record<string, unknown>;
      if (obj?.botUserKey) return obj.botUserKey as string;
      if (typeof obj?.value === "string") {
        const inner = JSON.parse(obj.value as string);
        if (inner?.botUserKey) return inner.botUserKey as string;
      }
    } catch { /* 무시 */ }
    return undefined;
  }

  const actionParams: Record<string, unknown> = req.body?.action?.params ?? {};
  const detailParams: Record<string, unknown> = req.body?.action?.detailParams ?? {};

  const mentionedKeys: string[] = [];
  const allParams = { ...actionParams };
  for (const [key, val] of Object.entries(detailParams)) {
    allParams[key] = val;
  }

  const mentionEntries = Object.entries(allParams)
    .filter(([key]) => key.startsWith("sys_user_mention"))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [, val] of mentionEntries) {
    const key = extractBotUserKey(val);
    if (key && !mentionedKeys.includes(key)) mentionedKeys.push(key);
  }

  if (mentionedKeys.length === 0) {
    return res.json({ version: "2.0", template: { outputs: [plainText("❌ 멘션을 인식하지 못했어요.\n사용법: 아이디 @닉네임")] } });
  }

  const text = mentionedKeys.map((id, i) => `${i + 1}. ${id}`).join("\n");
  return res.json({ version: "2.0", template: { outputs: [plainText(text)] } });
});

// ──────────────────────────────────────────────
// POST /api/kakao/admin/sync-nicknames
// users 테이블 기준으로 room_users 닉네임 전체 동기화
// Header: x-admin-token: <ADMIN_TOKEN>
// ──────────────────────────────────────────────
router.post("/admin/sync-nicknames", async (req: Request, res: Response) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken || req.headers["x-admin-token"] !== adminToken) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }
  try {
    // users 테이블에서 전체 user_id, nickname 읽기
    const usersResult = await pool.query<{ user_id: string; nickname: string }>(
      "SELECT user_id, nickname FROM users WHERE nickname IS NOT NULL AND nickname != ''"
    );
    const rows = usersResult.rows;

    // room_users 일괄 업데이트
    let updated = 0;
    for (const row of rows) {
      const r = await pool.query(
        "UPDATE room_users SET nickname = $1 WHERE user_id = $2 AND nickname != $1",
        [row.nickname, row.user_id]
      );
      updated += r.rowCount ?? 0;
    }

    return res.json({
      ok: true,
      usersScanned: rows.length,
      roomUsersUpdated: updated,
    });
  } catch (err) {
    logger.error({ err }, "sync-nicknames failed");
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ──────────────────────────────────────────────
// 카카오 이벤트 웹훅 (entrance 등)
// POST /api/kakao/event
// 카카오 OBT 설정 > 이벤트 수신 URL에 등록 필요
// ──────────────────────────────────────────────
router.post("/event", async (req: Request, res: Response) => {
  const eventType: string = req.body?.type ?? '';

  // ── 방 입장(초대) 이벤트 ──────────────────────────────────────────────
  if (eventType === 'entrance') {
    const inviterId: string = req.body?.payload?.inviter?.botUserKey ?? '';
    const roomId: string    = req.body?.group?.botGroupKey ?? '';

    if (!inviterId || !roomId) {
      return res.status(200).json({ version: '2.0', template: { outputs: [] } });
    }

    const todayKST = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const countRes = await pool.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM event_invite_log WHERE user_id = $1 AND activity_date = $2::date`,
      [inviterId, todayKST],
    );
    const currentCount = parseInt(countRes.rows[0].c, 10);

    if (currentCount >= 5) {
      return res.json(multiOutput(
        [mentionText(`{{#mentions.u}} 오늘은 이미 5곳 모두 초대 완료했어요! 🎉\n\n💙💙💙💙💙 달성!\n@초능력자 에너지흡수 로 보상을 받아가세요 🌀`)],
        { u: { type: 'botUserKey', id: inviterId } },
      ));
    }

    const insertRes = await pool.query(
      `INSERT INTO event_invite_log (user_id, room_id, activity_date) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING`,
      [inviterId, roomId, todayKST],
    );

    if ((insertRes.rowCount ?? 0) === 0) {
      // 중복 방 — 조용히 무시
      return res.status(200).json({ version: '2.0', template: { outputs: [] } });
    }

    const newCount = currentCount + 1;
    const hearts   = '💙'.repeat(newCount) + '🤍'.repeat(5 - newCount);
    const tailMsg  = newCount >= 5
      ? '\n\n✨ 5회 달성! @초능력자 에너지흡수 로 보상을 받아가세요!'
      : `\n@초능력자 에너지흡수로 보상을 받아가세요!\n${5 - newCount}곳 더 초대 가능해요`;

    req.log.info({ inviterId, roomId, newCount }, '[event] entrance 처리 완료');

    return res.json(multiOutput(
      [mentionText(
        `{{#mentions.u}} 초능력자의 기운이 스며들고 있어요! ⚡\n\n` +
        `이벤트 참여 완료!\n참여 횟수 : ${hearts}${tailMsg}`,
      )],
      { u: { type: 'botUserKey', id: inviterId } },
    ));
  }

  // 기타 이벤트 타입 — 200 OK로 응답
  req.log.info({ eventType }, '[event] 처리하지 않는 이벤트');
  return res.status(200).json({ version: '2.0', template: { outputs: [] } });
});

// 서버 시작 시 초능력자 base 컴포넌트 초기화 + 5분마다 갱신
void refreshSpBase();
setInterval(() => { void refreshSpBase(); }, SP_BASE_TTL_MS);

/** 서버 시작 시 랭킹 캐시 사전 워밍업 — 첫 방문 유저도 즉시 응답 */
export async function warmRankingCaches(): Promise<void> {
  const now = Date.now();
  const [sp, asset] = await Promise.all([
    _buildSpRanking(),
    _buildAssetRanking(),
  ]);
  _spRankCache    = { data: sp.ranking,    updatedAt: sp.updatedAt,    expiresAt: now + RANK_CACHE_TTL, refreshing: false };
  _assetRankCache = { data: asset.ranking, updatedAt: asset.updatedAt, expiresAt: now + RANK_CACHE_TTL, refreshing: false };
}

export default router;
