import { pool } from '@workspace/db';
import { logger } from './logger';
import { getTodayKST, adminAddScore, recordWin, isComboActive } from './gameState';

export const IS_PRODUCTION = !!process.env.REPLIT_DEPLOYMENT;

// ── 유물 카탈로그 (10개 카테고리, 각 1·2·3성) ────────────────
interface ArtifactCategory {
  name1: string;
  name2: string;
  name3: string;
  img1: number;
  img2: number;
  img3: number;
}

const ARTIFACT_CATALOG: ArtifactCategory[] = [
  { name1: "탐험가의 나침반", name2: "별자리 나침반",    name3: "아스트롤라베",      img1:  1, img2: 30, img3: 84 },
  { name1: "시간의 모래시계", name2: "날개 모래시계",    name3: "영원의 모래시계",   img1:  5, img2: 29, img3: 65 },
  { name1: "마법사의 랜턴",   name2: "불꽃 랜턴",        name3: "결정 랜턴",         img1:  6, img2: 21, img3: 63 },
  { name1: "고대의 거울",     name2: "달빛 거울",        name3: "심연의 거울",       img1:  7, img2: 19, img3: 33 },
  { name1: "고대의 성배",     name2: "빛의 성배",        name3: "은하의 성배",       img1:  8, img2: 45, img3: 73 },
  { name1: "고대의 마법서",   name2: "비전 마법서",      name3: "운명의 두루마리",   img1: 10, img2: 69, img3: 83 },
  { name1: "신비한 보물함",   name2: "마법의 상자",      name3: "우주 마법상자",     img1: 11, img2: 37, img3: 86 },
  { name1: "고대의 왕관",     name2: "꽃의 왕관",        name3: "크리스탈 왕관",     img1: 13, img2: 20, img3: 34 },
  { name1: "마나 물약",       name2: "보라빛 물약",      name3: "크리스탈 물약",     img1: 18, img2: 39, img3: 71 },
  { name1: "마법사의 깃털펜",   name2: "달빛 깃털펜",      name3: "영혼의 깃털펜",     img1: 56, img2: 67, img3: 75 },
];

function getCatalogEntry(name: string): { cat: ArtifactCategory; star: number } | null {
  for (const cat of ARTIFACT_CATALOG) {
    if (cat.name1 === name) return { cat, star: 1 };
    if (cat.name2 === name) return { cat, star: 2 };
    if (cat.name3 === name) return { cat, star: 3 };
  }
  return null;
}

const ITEM_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://chosung.app'
  : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://chosung.app';

export function getArtifactImageUrl(name: string): string {
  const entry = getCatalogEntry(name);
  if (!entry) return '';
  const { cat, star } = entry;
  const imgNum = star === 1 ? cat.img1 : star === 2 ? cat.img2 : cat.img3;
  const pad = String(imgNum).padStart(2, '0');
  return `${ITEM_BASE_URL}/items/item_${pad}.png`;
}

function randomName(star: number): string {
  const cat = ARTIFACT_CATALOG[Math.floor(Math.random() * ARTIFACT_CATALOG.length)];
  return star === 1 ? cat.name1 : star === 2 ? cat.name2 : cat.name3;
}

function promotedName(currentName: string): string {
  const entry = getCatalogEntry(currentName);
  if (!entry || entry.star >= 3) return currentName;
  return entry.star === 1 ? entry.cat.name2 : entry.cat.name3;
}

// ── 타입 정의 ────────────────────────────────────────
export interface ArtifactRow {
  userId: string;
  artifactName: string;
  star: number;
  level: number;
}

export interface UpgradeResult {
  ok: boolean;
  errorMsg?: string;
  result?: 'success' | 'keep' | 'fail';
  starBefore: number;
  levelBefore: number;
  starAfter: number;
  levelAfter: number;
  cost: number;
  artifactName: string;
}

export interface PromoteResult {
  ok: boolean;
  errorMsg?: string;
  result?: 'success' | 'fail';
  starBefore: number;
  levelBefore: number;
  starAfter: number;
  levelAfter: number;
  cost: number;
  artifactNameBefore: string;
  artifactNameAfter: string;
  replacementStar?: number;
  replacementLevel?: number;
}

export interface ExchangeResult {
  ok: boolean;
  errorMsg?: string;
  star: number;
  level: number;
  cost: number;
  artifactNameBefore: string;
  artifactNameAfter: string;
}

export interface RewardResult {
  baseReward: number;
  artifactBonusRate: number;
  artifactBonusPt: number;
  comboPct: number;
  comboPtBonus: number;
  regularComboTriggered: boolean;
  finalReward: number;
}

export interface BattleResult {
  ok: boolean;
  errorMsg?: string;
  won?: boolean;
  challengerPower: number;
  opponentPower: number;
  winRate: number;
  stolenPoint: number;
  entryCost: number;
  challengerArtifact: ArtifactRow;
  opponentArtifact: ArtifactRow;
  opponentNick: string;
}

// ── 인메모리 캐시 ────────────────────────────────────
const artifactCache  = new Map<string, ArtifactRow>();
const remainderCache = new Map<string, number>();

// ── DB 초기화 ─────────────────────────────────────────
export async function initArtifactDb(): Promise<void> {
  // users 테이블에 포인트 로그용 컬럼 추가
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned_point BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent_point  BIGINT NOT NULL DEFAULT 0`);

  // 유물 보유 테이블
  await pool.query(`CREATE TABLE IF NOT EXISTS user_artifacts (
    user_id       VARCHAR(255) PRIMARY KEY,
    artifact_name VARCHAR(100) NOT NULL,
    star          SMALLINT     NOT NULL DEFAULT 1,
    level         SMALLINT     NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`);

  // 유물 통계 테이블
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_stats (
    user_id               VARCHAR(255) PRIMARY KEY,
    total_upgrade_try     INTEGER NOT NULL DEFAULT 0,
    total_upgrade_success INTEGER NOT NULL DEFAULT 0,
    total_upgrade_keep    INTEGER NOT NULL DEFAULT 0,
    total_upgrade_fail    INTEGER NOT NULL DEFAULT 0,
    total_promotion_try   INTEGER NOT NULL DEFAULT 0,
    total_promotion_success INTEGER NOT NULL DEFAULT 0,
    total_promotion_fail  INTEGER NOT NULL DEFAULT 0
  )`);

  // 보너스 소수점 누적
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_bonus_remainder (
    user_id          VARCHAR(255) PRIMARY KEY,
    bonus_remainder  DOUBLE PRECISION NOT NULL DEFAULT 0
  )`);

  // 배틀 일일 데이터
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_battle_data (
    user_id               VARCHAR(255) PRIMARY KEY,
    battle_win_count      INTEGER NOT NULL DEFAULT 0,
    battle_lose_count     INTEGER NOT NULL DEFAULT 0,
    battle_today_count    INTEGER NOT NULL DEFAULT 0,
    battle_last_reset_date VARCHAR(10) NOT NULL DEFAULT ''
  )`);

  // 배틀 대상 제한
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_battle_targets (
    challenger_user_id VARCHAR(255) NOT NULL,
    target_user_id     VARCHAR(255) NOT NULL,
    battle_count_today INTEGER NOT NULL DEFAULT 0,
    date               VARCHAR(10) NOT NULL DEFAULT '',
    PRIMARY KEY (challenger_user_id, target_user_id)
  )`);

  // 강화 로그
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_upgrade_log (
    log_id       BIGSERIAL    PRIMARY KEY,
    user_id      VARCHAR(255) NOT NULL,
    artifact_name VARCHAR(100) NOT NULL,
    star_before  SMALLINT     NOT NULL,
    level_before SMALLINT     NOT NULL,
    star_after   SMALLINT     NOT NULL,
    level_after  SMALLINT     NOT NULL,
    result       VARCHAR(10)  NOT NULL,
    cost         INTEGER      NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`);

  // 성급강화 로그
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_promotion_log (
    log_id              BIGSERIAL    PRIMARY KEY,
    user_id             VARCHAR(255) NOT NULL,
    artifact_name_before VARCHAR(100) NOT NULL,
    artifact_name_after  VARCHAR(100) NOT NULL,
    star_before         SMALLINT     NOT NULL,
    level_before        SMALLINT     NOT NULL,
    star_after          SMALLINT     NOT NULL,
    level_after         SMALLINT     NOT NULL,
    result              VARCHAR(10)  NOT NULL,
    cost                INTEGER      NOT NULL,
    replacement_star    SMALLINT,
    replacement_level   SMALLINT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`);

  // 배틀 로그
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_battle_log (
    log_id               BIGSERIAL    PRIMARY KEY,
    challenger_user_id   VARCHAR(255) NOT NULL,
    opponent_user_id     VARCHAR(255) NOT NULL,
    winner_user_id       VARCHAR(255) NOT NULL,
    loser_user_id        VARCHAR(255) NOT NULL,
    challenger_power     INTEGER      NOT NULL,
    opponent_power       INTEGER      NOT NULL,
    challenger_win_rate  DOUBLE PRECISION NOT NULL,
    stolen_point         INTEGER      NOT NULL,
    entry_cost           INTEGER      NOT NULL,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`);

  // 포인트 로그
  await pool.query(`CREATE TABLE IF NOT EXISTS artifact_point_log (
    log_id        BIGSERIAL    PRIMARY KEY,
    user_id       VARCHAR(255) NOT NULL,
    change_amount BIGINT       NOT NULL,
    change_type   VARCHAR(30)  NOT NULL,
    reason        VARCHAR(100) NOT NULL DEFAULT '',
    balance_before BIGINT      NOT NULL DEFAULT 0,
    balance_after  BIGINT      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_apt_log_user ON artifact_point_log (user_id)`);
}

// ── 핵심 계산 함수 ────────────────────────────────────

/** 성급별 최대 레벨 */
export function getMaxLevel(star: number): number {
  if (star === 1) return 50;
  if (star === 2) return 80;
  return 100;
}

/** 일반 강화 비용 (현재 n강 → n+1강)
 *  CEM 최적화 + 10배 스케일: 1성 ×6.59 / 2성 ×7.50 / 3성 ×13.09
 */
export function calcUpgradeCost(star: number, level: number): number {
  const n = level;
  if (star === 1) {
    let base: number;
    if (n <= 10)  base = 2 * n;
    else if (n <= 20) base = 20 + 2 * (n - 10);
    else if (n <= 30) base = 40 + 3 * (n - 20);
    else if (n <= 40) base = 70 + 5 * (n - 30);
    else              base = 120 + 7 * (n - 40);
    return Math.max(1, Math.round(base * 6.59));
  }
  if (star === 2) {
    let base: number;
    if (n <= 40)  base = 15 + 3 * n;
    else if (n <= 60) base = 135 + 6 * (n - 40);
    else if (n <= 70) base = 255 + 10 * (n - 60);
    else              base = 355 + 15 * (n - 70);
    return Math.max(1, Math.round(base * 7.50));
  }
  // star === 3
  let base: number;
  if (n <= 20)   base = 40 + 3 * n;
  else if (n <= 40) base = 100 + 5 * (n - 20);
  else if (n <= 60) base = 200 + 7 * (n - 40);
  else if (n <= 80) base = 340 + 11 * (n - 60);
  else if (n <= 90) base = 560 + 16 * (n - 80);
  else              base = 720 + 22 * (n - 90);
  return Math.max(1, Math.round(base * 13.09));
}

/** 일반 강화 확률 { success, keep, fail } (합 = 100)
 *  CEM 최적화 적용:
 *    1성: 성공 +2.62%p / 실패 +0.49%p
 *    2성: 성공 +2.06%p / 실패 +1.18%p
 *    3성: 성공 +0.47%p / 실패 -0.03%p (사실상 동일)
 */
export function calcUpgradeProb(star: number, level: number): { success: number; keep: number; fail: number } {
  const n = level;
  if (star === 1) {
    if (n <= 5)  return { success: 90, keep:  8, fail:  2 };
    if (n <= 15) return { success: 85, keep: 10, fail:  5 };
    if (n <= 25) return { success: 79, keep: 13, fail:  8 };
    if (n <= 35) return { success: 73, keep: 16, fail: 11 };
    if (n <= 45) return { success: 68, keep: 18, fail: 14 };
    return         { success: 63, keep: 20, fail: 17 };
  }
  if (star === 2) {
    if (n <= 20) return { success: 86, keep: 10, fail:  4 };
    if (n <= 40) return { success: 79, keep: 13, fail:  8 };
    if (n <= 60) return { success: 72, keep: 17, fail: 11 };
    if (n <= 70) return { success: 65, keep: 21, fail: 14 };
    return         { success: 59, keep: 24, fail: 17 };
  }
  // star === 3 (거의 변화 없음)
  if (n <= 20) return { success: 82, keep: 13, fail:  5 };
  if (n <= 40) return { success: 75, keep: 16, fail:  9 };
  if (n <= 60) return { success: 68, keep: 19, fail: 13 };
  if (n <= 80) return { success: 62, keep: 23, fail: 15 };
  if (n <= 90) return { success: 57, keep: 28, fail: 15 };
  return         { success: 53, keep: 32, fail: 15 };
}

/** 유물 보너스율 (소수점, 예: 1.1 = 1.1%)
 *  CEM 최적화 적용: 1성 4→14.89%, 2성 8.68→29.51%, 3성 20.43→44.69%
 */
export function calcBonusRate(star: number, level: number): number {
  if (star === 1) return Math.min(14.89, 4.00 + 0.218 * level);
  if (star === 2) return Math.min(29.51, 8.68 + 0.260 * level);
  return                          Math.min(44.69, 20.43 + 0.243 * level);
}

/** 전투력 계산 */
export function calcPower(star: number, level: number): number {
  if (star === 1) return 100 + 5  * level;
  if (star === 2) return 450 + 10 * level;
  return                      1500 + 18 * level;
}

/** 성급강화 비용
 *  CEM 최적화 + 10배 스케일: 1→2성 10140P / 2→3성 120320P
 */
export function getPromotionCost(star: number): number {
  if (star === 1) return 10140;
  if (star === 2) return 120320;
  return 0;
}

/** 성급강화 성공률
 *  CEM 최적화 적용: 1→2성 69% / 2→3성 54%
 */
export function getPromotionSuccessRate(star: number): number {
  if (star === 1) return 69;
  if (star === 2) return 54;
  return 0;
}

/** 유물 교체 비용 (같은 성급 다른 카테고리로 변경) */
export function getExchangeCost(star: number): number {
  if (star === 1) return 3000;
  if (star === 2) return 15000;
  return 50000;
}

// ── 배틀 신청비 ─────────────────────────────────────
export function getBattleEntryCost(star: number): number {
  if (star === 1) return 1000;
  if (star === 2) return 5000;
  return 15000;
}

// ── 유물 조회 및 생성 ─────────────────────────────────

export async function getUserArtifact(userId: string): Promise<ArtifactRow | null> {
  const cached = artifactCache.get(userId);
  if (cached) return cached;

  const { rows } = await pool.query<{ artifact_name: string; star: number; level: number }>(
    `SELECT artifact_name, star, level FROM user_artifacts WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const row: ArtifactRow = { userId, artifactName: rows[0].artifact_name, star: rows[0].star, level: rows[0].level };
  artifactCache.set(userId, row);
  return row;
}

/** 유물이 없으면 1성 1강 기본 유물 생성 후 반환 */
export async function ensureUserArtifact(userId: string): Promise<ArtifactRow> {
  const existing = await getUserArtifact(userId);
  if (existing) return existing;

  const name = randomName(1);
  await pool.query(
    `INSERT INTO user_artifacts (user_id, artifact_name, star, level)
     VALUES ($1, $2, 1, 1) ON CONFLICT (user_id) DO NOTHING`,
    [userId, name]
  );
  // 통계 행 보장
  await pool.query(
    `INSERT INTO artifact_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  );
  const row: ArtifactRow = { userId, artifactName: name, star: 1, level: 1 };
  artifactCache.set(userId, row);
  return row;
}

// ── DB에서 포인트 직접 조회 ───────────────────────────
async function getUserPoint(userId: string): Promise<number> {
  const { rows } = await pool.query<{ score: string }>(
    `SELECT score FROM users WHERE user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return 0;
  return Number(rows[0].score);
}

// ── 포인트 로그 저장 ──────────────────────────────────
async function writePointLog(
  client: { query: (q: string, p?: unknown[]) => Promise<unknown> },
  userId: string,
  changeAmount: number,
  changeType: string,
  reason: string,
  balanceBefore: number,
  balanceAfter: number,
): Promise<void> {
  await client.query(
    `INSERT INTO artifact_point_log (user_id, change_amount, change_type, reason, balance_before, balance_after)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, changeAmount, changeType, reason, balanceBefore, balanceAfter]
  );
}

// ── 일반 강화 ──────────────────────────────────────────
export async function upgradeArtifact(userId: string): Promise<UpgradeResult> {
  const artifact = await ensureUserArtifact(userId);
  const { star, level, artifactName } = artifact;
  const maxLevel = getMaxLevel(star);

  if (level >= maxLevel) {
    return {
      ok: false,
      errorMsg: star < 3
        ? `🏛️ 이미 ${star}성 최대 강화(${maxLevel}강)에요!\n성급강화를 도전해보세요!`
        : `🏛️ 3성 ${maxLevel}강! 이미 최고 상태예요!`,
      starBefore: star, levelBefore: level, starAfter: star, levelAfter: level,
      cost: 0, artifactName,
    };
  }

  const cost = calcUpgradeCost(star, level);
  const currentPt = await getUserPoint(userId);
  if (currentPt < cost) {
    return {
      ok: false,
      errorMsg: `💸 포인트가 부족해요!\n필요: ${cost}P / 보유: ${currentPt}P`,
      starBefore: star, levelBefore: level, starAfter: star, levelAfter: level,
      cost, artifactName,
    };
  }

  // 강화 결과 랜덤 판정
  const prob = calcUpgradeProb(star, level);
  const roll = Math.random() * 100;
  let upgradeResult: 'success' | 'keep' | 'fail';
  let newLevel = level;
  if (roll < prob.success)              { upgradeResult = 'success'; newLevel = level + 1; }
  else if (roll < prob.success + prob.keep) { upgradeResult = 'keep'; }
  else                                  { upgradeResult = 'fail'; newLevel = Math.max(1, level - 1); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 포인트 차감
    const { rows: ptRows } = await client.query<{ score: string }>(
      `UPDATE users SET score = GREATEST(0, score - $1), total_spent_point = total_spent_point + $1
       WHERE user_id = $2 RETURNING score`,
      [cost, userId]
    );
    const balanceAfterPt = Number(ptRows[0]?.score ?? 0);

    // 유물 업데이트
    await client.query(
      `UPDATE user_artifacts SET level = $1, updated_at = NOW() WHERE user_id = $2`,
      [newLevel, userId]
    );

    // 통계 업데이트
    const statCol = upgradeResult === 'success' ? 'total_upgrade_success'
                  : upgradeResult === 'keep'    ? 'total_upgrade_keep'
                  : 'total_upgrade_fail';
    await client.query(
      `INSERT INTO artifact_stats (user_id, total_upgrade_try, ${statCol})
       VALUES ($1, 1, 1)
       ON CONFLICT (user_id) DO UPDATE
         SET total_upgrade_try = artifact_stats.total_upgrade_try + 1,
             ${statCol} = artifact_stats.${statCol} + 1`,
      [userId]
    );

    // 포인트 로그
    await writePointLog(client, userId, -cost, 'upgrade', `${star}성 ${level}강 → ${newLevel}강`, currentPt, balanceAfterPt);

    // 강화 로그
    await client.query(
      `INSERT INTO artifact_upgrade_log (user_id, artifact_name, star_before, level_before, star_after, level_after, result, cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, artifactName, star, level, star, newLevel, upgradeResult, cost]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 캐시 업데이트
  const updated = { ...artifact, level: newLevel };
  artifactCache.set(userId, updated);

  return {
    ok: true,
    result: upgradeResult,
    starBefore: star, levelBefore: level,
    starAfter: star, levelAfter: newLevel,
    cost, artifactName,
  };
}

// ── 성급 강화 실패 보상 레벨 랜덤 뽑기 ─────────────────
function pickReplacementLevel(star: number): number {
  // 1성 실패 → 1성 30~39강 보상
  // 2성 실패 → 2성 50~59강 보상
  const probs1 = [18, 16, 14, 12, 10, 9, 7, 6, 5, 3]; // 30~39강
  const probs2 = [18, 16, 14, 12, 10, 9, 7, 6, 5, 3]; // 50~59강
  const probs = star === 1 ? probs1 : probs2;
  const base  = star === 1 ? 30 : 50;
  const total = probs.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < probs.length; i++) {
    roll -= probs[i];
    if (roll < 0) return base + i;
  }
  return base;
}

// ── 성급강화 ──────────────────────────────────────────
export async function promoteArtifact(userId: string): Promise<PromoteResult> {
  const artifact = await ensureUserArtifact(userId);
  const { star, level, artifactName } = artifact;

  if (star === 3) {
    return {
      ok: false,
      errorMsg: '🏛️ 3성은 최종 성급이에요! 성급강화가 불가능해요.',
      starBefore: star, levelBefore: level, starAfter: star, levelAfter: level,
      cost: 0, artifactNameBefore: artifactName, artifactNameAfter: artifactName,
    };
  }

  const requiredLevel = getMaxLevel(star);
  if (level < requiredLevel) {
    return {
      ok: false,
      errorMsg: `🏛️ ${star}성 ${requiredLevel}강이어야 성급강화가 가능해요!\n현재: ${star}성 ${level}강`,
      starBefore: star, levelBefore: level, starAfter: star, levelAfter: level,
      cost: 0, artifactNameBefore: artifactName, artifactNameAfter: artifactName,
    };
  }

  const cost = getPromotionCost(star);
  const successRate = getPromotionSuccessRate(star);
  const currentPt = await getUserPoint(userId);
  if (currentPt < cost) {
    return {
      ok: false,
      errorMsg: `💸 포인트가 부족해요!\n필요: ${cost.toLocaleString()}P / 보유: ${currentPt.toLocaleString()}P`,
      starBefore: star, levelBefore: level, starAfter: star, levelAfter: level,
      cost, artifactNameBefore: artifactName, artifactNameAfter: artifactName,
    };
  }

  const success = Math.random() * 100 < successRate;
  const newStar = success ? star + 1 : star;
  let newLevel = success ? 1 : level;
  let replacementStar: number | undefined;
  let replacementLevel: number | undefined;
  const newName = success ? promotedName(artifactName) : artifactName;

  if (!success) {
    replacementLevel = pickReplacementLevel(star);
    replacementStar  = star;
    newLevel = replacementLevel;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: ptRows } = await client.query<{ score: string }>(
      `UPDATE users SET score = GREATEST(0, score - $1), total_spent_point = total_spent_point + $1
       WHERE user_id = $2 RETURNING score`,
      [cost, userId]
    );
    const balanceAfterPt = Number(ptRows[0]?.score ?? 0);

    await client.query(
      `UPDATE user_artifacts SET artifact_name = $1, star = $2, level = $3, updated_at = NOW()
       WHERE user_id = $4`,
      [newName, newStar, newLevel, userId]
    );

    // 통계
    const statSucc = success ? 'total_promotion_success' : 'total_promotion_fail';
    await client.query(
      `INSERT INTO artifact_stats (user_id, total_promotion_try, ${statSucc})
       VALUES ($1, 1, 1)
       ON CONFLICT (user_id) DO UPDATE
         SET total_promotion_try = artifact_stats.total_promotion_try + 1,
             ${statSucc} = artifact_stats.${statSucc} + 1`,
      [userId]
    );

    await writePointLog(client, userId, -cost, 'promotion', `${star}성 → ${newStar}성 (${success ? '성공' : '실패'})`, currentPt, balanceAfterPt);

    await client.query(
      `INSERT INTO artifact_promotion_log (user_id, artifact_name_before, artifact_name_after, star_before, level_before, star_after, level_after, result, cost, replacement_star, replacement_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [userId, artifactName, newName, star, level, newStar, newLevel, success ? 'success' : 'fail', cost, replacementStar ?? null, replacementLevel ?? null]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = { ...artifact, artifactName: newName, star: newStar, level: newLevel };
  artifactCache.set(userId, updated);

  return {
    ok: true,
    result: success ? 'success' : 'fail',
    starBefore: star, levelBefore: level,
    starAfter: newStar, levelAfter: newLevel,
    cost, artifactNameBefore: artifactName, artifactNameAfter: newName,
    replacementStar, replacementLevel,
  };
}

// ── 유물 교체 (같은 성급, 다른 카테고리) ──────────────────
export async function exchangeArtifact(userId: string): Promise<ExchangeResult> {
  const artifact = await ensureUserArtifact(userId);
  const { star, level, artifactName } = artifact;

  const cost = getExchangeCost(star);
  const currentPt = await getUserPoint(userId);
  if (currentPt < cost) {
    return {
      ok: false,
      errorMsg: `포인트가 부족해요! 교체 비용: ${cost}P / 보유: ${currentPt}P`,
      star, level, cost,
      artifactNameBefore: artifactName, artifactNameAfter: artifactName,
    };
  }

  // 현재 카테고리 인덱스 찾기
  const currentEntry = getCatalogEntry(artifactName);
  const currentCatIdx = currentEntry
    ? ARTIFACT_CATALOG.indexOf(currentEntry.cat)
    : -1;

  // 현재와 다른 카테고리 랜덤 선택
  let newCatIdx: number;
  do {
    newCatIdx = Math.floor(Math.random() * ARTIFACT_CATALOG.length);
  } while (newCatIdx === currentCatIdx);
  const newCat = ARTIFACT_CATALOG[newCatIdx];
  const newName = star === 1 ? newCat.name1 : star === 2 ? newCat.name2 : newCat.name3;

  const client = await (pool as any).connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users SET score = score - $1 WHERE user_id = $2`,
      [cost, userId]
    );
    await client.query(
      `UPDATE user_artifacts SET artifact_name = $1, updated_at = NOW() WHERE user_id = $2`,
      [newName, userId]
    );
    await writePointLog(
      client, userId, -cost, 'artifact_exchange',
      `유물 교체: ${artifactName} → ${newName}`,
      currentPt, currentPt - cost,
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  const updated = { ...artifact, artifactName: newName };
  artifactCache.set(userId, updated);

  return {
    ok: true,
    star, level, cost,
    artifactNameBefore: artifactName,
    artifactNameAfter: newName,
  };
}

// ── 보너스 소수점 누적 ───────────────────────────────
async function loadRemainder(userId: string): Promise<number> {
  const cached = remainderCache.get(userId);
  if (cached !== undefined) return cached;

  const { rows } = await pool.query<{ bonus_remainder: string }>(
    `SELECT bonus_remainder FROM artifact_bonus_remainder WHERE user_id = $1`,
    [userId]
  );
  const val = rows.length > 0 ? Number(rows[0].bonus_remainder) : 0;
  remainderCache.set(userId, val);
  return val;
}

function persistRemainder(userId: string, remainder: number): void {
  remainderCache.set(userId, remainder);
  pool.query(
    `INSERT INTO artifact_bonus_remainder (user_id, bonus_remainder) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET bonus_remainder = EXCLUDED.bonus_remainder`,
    [userId, remainder]
  ).catch(() => {});
}

// ── 최종 보상 계산 ─────────────────────────────────────
/**
 * baseReward: 기본 보상 포인트
 * gameType: 어떤 게임인지 (콤보 판단용)
 * isWin: 승리 판정 여부 (콤보 카운트 증가 여부)
 *
 * 콤보: 5분 내 5회 승리 → 60초간 +20% (세 게임 공통)
 */
export async function computeReward(
  userId: string,
  baseReward: number,
  gameType: 'chosung' | 'hunmin',
  isWin: boolean,
): Promise<RewardResult> {
  // 1. 콤보 판정 (5분 내 5회 → 60초 발동)
  let regularComboTriggered = false;
  if (isWin) {
    regularComboTriggered = recordWin(userId, gameType);
  }
  const comboPct     = isComboActive(userId) ? 20 : 0;
  const comboPtBonus = Math.round(baseReward * comboPct / 100);

  if (IS_PRODUCTION) {
    return {
      baseReward,
      artifactBonusRate: 0,
      artifactBonusPt: 0,
      comboPct,
      comboPtBonus,
      regularComboTriggered,
      finalReward: baseReward + comboPtBonus,
    };
  }

  // 개발 환경: 구 유물 보너스 적용
  const artifact = await ensureUserArtifact(userId);
  const { star, level } = artifact;
  const artifactBonusRate = calcBonusRate(star, level);
  const totalBonusRate    = artifactBonusRate + comboPct;

  const rawBonus           = baseReward * (totalBonusRate / 100);
  const intBonus           = Math.floor(rawBonus);
  const decBonus           = rawBonus - intBonus;
  const remainder          = await loadRemainder(userId);
  const newRemainder       = remainder + decBonus;
  const extraFromRemainder = Math.floor(newRemainder);
  persistRemainder(userId, newRemainder - extraFromRemainder);

  const artifactBonusPt = intBonus + extraFromRemainder - comboPtBonus;
  const finalReward     = baseReward + intBonus + extraFromRemainder;

  return {
    baseReward,
    artifactBonusRate,
    artifactBonusPt: Math.max(0, artifactBonusPt),
    comboPct,
    comboPtBonus,
    regularComboTriggered,
    finalReward,
  };
}

// ── 유물 랭킹 ──────────────────────────────────────────
export async function getArtifactRanking(): Promise<{
  userId: string;
  nickname: string;
  artifactName: string;
  star: number;
  level: number;
  power: number;
  bonusRate: number;
  rankScore: number;
}[]> {
  const { rows } = await pool.query<{
    user_id: string; nickname: string; artifact_name: string; star: number; level: number;
  }>(
    `SELECT u.user_id, u.nickname, a.artifact_name, a.star, a.level
     FROM user_artifacts a JOIN users u ON u.user_id = a.user_id
     ORDER BY (a.star * 100000 + a.level * 1000 + (
       CASE WHEN a.star = 1 THEN 100 + 5 * a.level
            WHEN a.star = 2 THEN 450 + 10 * a.level
            ELSE 1500 + 18 * a.level END
     )) DESC
     LIMIT 10`
  );

  return rows.map(r => ({
    userId:       r.user_id,
    nickname:     r.nickname,
    artifactName: r.artifact_name,
    star:         r.star,
    level:        r.level,
    power:        calcPower(r.star, r.level),
    bonusRate:    calcBonusRate(r.star, r.level),
    rankScore:    r.star * 100000 + r.level * 1000 + calcPower(r.star, r.level),
  }));
}

// ── 유물 배틀 ──────────────────────────────────────────
export async function doBattle(
  challengerId: string,
  challengerNick: string,
  targetId: string,
  targetNick: string,
): Promise<BattleResult> {
  if (challengerId === targetId) {
    return {
      ok: false, errorMsg: '⚔️ 자기 자신에게 배틀을 신청할 수 없어요!',
      challengerPower: 0, opponentPower: 0, winRate: 0, stolenPoint: 0, entryCost: 0,
      challengerArtifact: { userId: challengerId, artifactName: '', star: 1, level: 1 },
      opponentArtifact:   { userId: targetId,     artifactName: '', star: 1, level: 1 },
      opponentNick: targetNick,
    };
  }

  const [challengerArtifact, opponentArtifact] = await Promise.all([
    ensureUserArtifact(challengerId),
    ensureUserArtifact(targetId),
  ]);

  const today = getTodayKST();

  // 배틀 일일 제한 확인
  const { rows: cdRows } = await pool.query<{ battle_today_count: number; battle_last_reset_date: string }>(
    `SELECT battle_today_count, battle_last_reset_date FROM artifact_battle_data WHERE user_id = $1`,
    [challengerId]
  );
  const cdToday = cdRows[0]?.battle_last_reset_date === today ? (cdRows[0]?.battle_today_count ?? 0) : 0;
  if (cdToday >= 15) {
    return {
      ok: false, errorMsg: '⚔️ 오늘 배틀 횟수를 모두 사용했어요! (하루 최대 15회)',
      challengerPower: 0, opponentPower: 0, winRate: 0, stolenPoint: 0, entryCost: 0,
      challengerArtifact, opponentArtifact, opponentNick: targetNick,
    };
  }

  // 상대 포인트 확인
  const opponentPt = await getUserPoint(targetId);
  if (opponentPt < 1000) {
    return {
      ok: false, errorMsg: `⚔️ ${targetNick}의 포인트가 1000P 미만이에요. 도전이 불가해요.`,
      challengerPower: 0, opponentPower: 0, winRate: 0, stolenPoint: 0, entryCost: 0,
      challengerArtifact, opponentArtifact, opponentNick: targetNick,
    };
  }

  // 신청비 확인
  const entryCost = getBattleEntryCost(challengerArtifact.star);
  const challengerPt = await getUserPoint(challengerId);
  if (challengerPt < entryCost) {
    return {
      ok: false, errorMsg: `💸 포인트가 부족해요!\n배틀 신청비: ${entryCost}P / 보유: ${challengerPt}P`,
      challengerPower: 0, opponentPower: 0, winRate: 0, stolenPoint: 0, entryCost,
      challengerArtifact, opponentArtifact, opponentNick: targetNick,
    };
  }

  // 전투력 계산
  const cPower = calcPower(challengerArtifact.star, challengerArtifact.level);
  const oPower = calcPower(opponentArtifact.star, opponentArtifact.level);
  const powerDiff = cPower - oPower;
  // 전투력 차이 100당 약 15%p 영향, 범위 5~95%
  const winRate = Math.min(95, Math.max(5, 50 + powerDiff * 0.15));
  const won = Math.random() * 100 < winRate;

  // 약탈량 계산 (패자 기준)
  const loserPt = won ? opponentPt : challengerPt - entryCost; // 신청비 차감 후 신청자 잔여
  const loserStar = won ? opponentArtifact.star : challengerArtifact.star;
  let stealRate: number, stealMin: number, stealMax: number;
  if (loserStar === 1)      { stealRate = 0.02; stealMin = 500;  stealMax = 8000;   }
  else if (loserStar === 2) { stealRate = 0.03; stealMin = 2000; stealMax = 30000;  }
  else                      { stealRate = 0.04; stealMin = 5000; stealMax = 100000; }

  let stolenPoint = Math.round(loserPt * stealRate);
  stolenPoint = Math.max(stealMin, Math.min(stealMax, stolenPoint));
  stolenPoint = Math.min(stolenPoint, loserPt); // 패자 잔여 이상 약탈 불가

  const winnerId = won ? challengerId : targetId;
  const loserId  = won ? targetId    : challengerId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 신청비 차감 (소각)
    await client.query(
      `UPDATE users SET score = GREATEST(0, score - $1), total_spent_point = total_spent_point + $1 WHERE user_id = $2`,
      [entryCost, challengerId]
    );

    // 약탈 (승자 +, 패자 -)
    await client.query(
      `UPDATE users SET score = score + $1 WHERE user_id = $2`,
      [stolenPoint, winnerId]
    );
    await client.query(
      `UPDATE users SET score = GREATEST(0, score - $1) WHERE user_id = $2`,
      [stolenPoint, loserId]
    );

    // 배틀 통계 업데이트 (신청자)
    await client.query(
      `INSERT INTO artifact_battle_data (user_id, battle_win_count, battle_lose_count, battle_today_count, battle_last_reset_date)
       VALUES ($1, $2, $3, 1, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         battle_win_count   = artifact_battle_data.battle_win_count + $2,
         battle_lose_count  = artifact_battle_data.battle_lose_count + $3,
         battle_today_count = CASE WHEN artifact_battle_data.battle_last_reset_date = $4
                                   THEN artifact_battle_data.battle_today_count + 1 ELSE 1 END,
         battle_last_reset_date = $4`,
      [challengerId, won ? 1 : 0, won ? 0 : 1, today]
    );

    // 배틀 통계 업데이트 (상대방)
    await client.query(
      `INSERT INTO artifact_battle_data (user_id, battle_win_count, battle_lose_count, battle_today_count, battle_last_reset_date)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (user_id) DO UPDATE SET
         battle_win_count  = artifact_battle_data.battle_win_count + $2,
         battle_lose_count = artifact_battle_data.battle_lose_count + $3`,
      [targetId, won ? 0 : 1, won ? 1 : 0, today]
    );

    // 같은 상대 공격 횟수 업데이트
    await client.query(
      `INSERT INTO artifact_battle_targets (challenger_user_id, target_user_id, battle_count_today, date)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (challenger_user_id, target_user_id) DO UPDATE SET
         battle_count_today = CASE WHEN artifact_battle_targets.date = $3
                                   THEN artifact_battle_targets.battle_count_today + 1 ELSE 1 END,
         date = $3`,
      [challengerId, targetId, today]
    );

    // 포인트 로그
    await writePointLog(client, challengerId, -entryCost, 'battle_entry', `배틀 신청비 (vs ${targetNick})`, challengerPt, challengerPt - entryCost);
    await writePointLog(
      client, winnerId, stolenPoint, 'battle_win',
      `배틀 승리 약탈 (vs ${won ? targetNick : challengerNick})`,
      won ? opponentPt : challengerPt - entryCost,
      won ? opponentPt + stolenPoint : challengerPt - entryCost + stolenPoint,
    );
    await writePointLog(
      client, loserId, -stolenPoint, 'battle_lose',
      `배틀 패배 약탈 (vs ${won ? challengerNick : targetNick})`,
      won ? opponentPt : challengerPt - entryCost,
      won ? opponentPt - stolenPoint : challengerPt - entryCost - stolenPoint,
    );

    // 배틀 로그
    await client.query(
      `INSERT INTO artifact_battle_log (challenger_user_id, opponent_user_id, winner_user_id, loser_user_id, challenger_power, opponent_power, challenger_win_rate, stolen_point, entry_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [challengerId, targetId, winnerId, loserId, cPower, oPower, winRate, stolenPoint, entryCost]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // rankingBoard 캐시 동기화 (승패 방향 버그 방지)
  const challengerDelta = won ? (-entryCost + stolenPoint) : (-entryCost - stolenPoint);
  const opponentDelta   = won ? -stolenPoint : stolenPoint;
  adminAddScore(challengerId, challengerDelta);
  adminAddScore(targetId, opponentDelta);

  return {
    ok: true,
    won,
    challengerPower: cPower,
    opponentPower: oPower,
    winRate,
    stolenPoint,
    entryCost,
    challengerArtifact,
    opponentArtifact,
    opponentNick: targetNick,
  };
}
