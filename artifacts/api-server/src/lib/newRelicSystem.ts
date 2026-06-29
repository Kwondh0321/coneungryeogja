// ── 신규 유물 시스템 ───────────────────────────────────────────────────────────
import { pool } from '@workspace/db';
import { logEvent } from './monitoring';

const ITEM_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://chosung.app'
  : process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'https://chosung.app';

// ── 등급 정의 ─────────────────────────────────────────────────────────────
export type RelicGrade = 1 | 2 | 3 | 4 | 5 | 6;
export const GRADE_NAMES: Record<RelicGrade, string> = {
  1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'S', 6: 'SS',
};
export const GRADE_STARS: Record<RelicGrade, string> = {
  1: '⚪', 2: '🟢', 3: '🔵', 4: '🟣', 5: '🟡', 6: '🔴',
};

// ── 유물 타입 카탈로그 (10종) ─────────────────────────────────────────────
export type RelicEffectType =
  | 'all_bonus'             // 모든 메인게임 포인트 +X%
  | 'enhance_cost_reduce'   // 강화 비용 -X%
  | 'chosung_bonus'         // 초성퀴즈 포인트 +X%
  | 'hunmin_bonus'          // 훈민정음 포인트 +X%
  | 'jamo_bonus'            // 자모연성 포인트 +X%
  | 'combo_bonus'           // 연속 정답 보너스 +X%
  | 'storage_bonus'         // 보관 효과 증가 (메타 효과)
  | 'exp_bonus';            // 유물 경험치 획득량 +X%

export interface RelicTypeDef {
  typeId:     number;
  typeName:   string;
  description: string;
  effectType: RelicEffectType;
  // 등급별 이미지 번호 (1=일반, 2=희귀, 3=고대, 4=각성, 5=초월, 6=신화)
  images:     [number, number, number, number, number, number];
  // 등급별 이름 접두어
  gradeNames: [string, string, string, string, string, string];
}

export const RELIC_TYPE_CATALOG: RelicTypeDef[] = [
  {
    typeId: 1, typeName: '나침반',
    description: '모든 게임 포인트 획득량 증가',
    effectType: 'all_bonus',
    images: [1, 30, 84, 2, 23, 87],
    gradeNames: ['낡은 나침반', '고대의 나침반', '별자리 나침반', '각성한 나침반', '초월한 나침반', '깨지지 않는 전설의 나침반'],
  },
  {
    typeId: 2, typeName: '모래시계',
    description: '유물 강화 비용 감소',
    effectType: 'enhance_cost_reduce',
    images: [5, 29, 65, 3, 24, 85],
    gradeNames: ['낡은 모래시계', '날개 모래시계', '영원의 모래시계', '각성한 모래시계', '초월한 모래시계', '멈추지 않는 전설의 모래시계'],
  },
  {
    typeId: 3, typeName: '랜턴',
    description: '초성퀴즈 포인트 획득량 증가',
    effectType: 'chosung_bonus',
    images: [6, 21, 63, 4, 25, 83],
    gradeNames: ['마법사의 랜턴', '불꽃 랜턴', '결정 랜턴', '각성한 랜턴', '초월한 랜턴', '꺼지지 않는 전설의 랜턴'],
  },
  {
    typeId: 4, typeName: '거울',
    description: '훈민정음 포인트 획득량 증가',
    effectType: 'hunmin_bonus',
    images: [7, 19, 33, 9, 26, 82],
    gradeNames: ['고대의 거울', '달빛 거울', '심연의 거울', '각성한 거울', '초월한 거울', '모든 것을 비추는 전설의 거울'],
  },
  {
    typeId: 7, typeName: '보물함',
    description: '자모연성 포인트 획득량 증가',
    effectType: 'jamo_bonus',
    images: [11, 37, 86, 15, 31, 81],
    gradeNames: ['신비한 보물함', '마법의 상자', '우주 마법상자', '각성한 보물함', '초월한 보물함', '바닥 없는 전설의 보물함'],
  },
  {
    typeId: 8, typeName: '왕관',
    description: '연속 정답 보너스 증가',
    effectType: 'combo_bonus',
    images: [13, 20, 34, 16, 32, 80],
    gradeNames: ['고대의 왕관', '꽃의 왕관', '크리스탈 왕관', '각성한 왕관', '초월한 왕관', '무너지지 않는 전설의 왕관'],
  },
  {
    typeId: 9, typeName: '물약',
    description: '보관함 유물 효과 증가',
    effectType: 'storage_bonus',
    images: [18, 39, 71, 17, 35, 79],
    gradeNames: ['마나 물약', '보라빛 물약', '크리스탈 물약', '각성한 물약', '초월한 물약', '은하를 담은 전설의 물약'],
  },
  {
    typeId: 10, typeName: '깃털펜',
    description: '유물 경험치 획득량 증가',
    effectType: 'exp_bonus',
    images: [56, 67, 75, 22, 36, 78],
    gradeNames: ['마법사의 깃털펜', '달빛 깃털펜', '영혼의 깃털펜', '각성한 깃털펜', '초월한 깃털펜', '지워지지 않는 전설의 깃털펜'],
  },
];

// ── 강화/레벨업 설정 ─────────────────────────────────────────────────────
export const RELIC_CONFIG = {
  MAX_LEVEL:   50,
  MAX_ENHANCE: 20,
  // 기본 효과값 (등급별 %) — v5.1 SS 95.0으로 상향 (구 77.52 대비 +22.5%)
  BASE_EFFECT: [6.45, 9.82, 16.43, 28.29, 45.06, 95.0] as const,
  // 레벨 1당 효과 증가율 — v3.7 1%로 하향 (50레벨 기준 150% 수렴)
  LEVEL_BONUS_PER_LEVEL: 0.01,
  // 강화 1당 효과 증가율
  ENHANCE_BONUS_PER_ENHANCE: 0.03,
  // 강화 성공률 (강화 0~19단계) — v3.6 A100 ML 최적화
  ENHANCE_SUCCESS_RATE: [95.00, 93.00, 90.00, 84.40, 79.25, 73.08, 67.93, 61.76, 45.52, 40.56, 36.42, 31.45, 27.31, 22.35, 18.21, 18.21, 18.21, 18.21, 14.20, 8.52],
  // 레벨업 비용 공식: grade * 705 * level — v3.7 5배 상향
  LEVEL_UP_COST_FACTOR: 705,
  // 강화 비용 공식: grade * 568 * 1.1166^enhance — v3.9 0.8배 하향
  ENHANCE_COST_BASE: 568,
  ENHANCE_COST_GROWTH: 1.1166,
  // 보관함 확장 비용 (슬롯당)
  INVENTORY_EXPAND_COST: 18_000,
  INVENTORY_EXPAND_MAX:  60,
  // 분해 환급율 (포인트) — v3.6 A100 ML 최적화, SS 추가
  DISMANTLE_REFUND: [630, 2_530, 10_100, 37_970, 126_570, 400_000] as const, // 등급-1 인덱스
  // 보관 효과 배율 (메인 효과 대비) — v3.6 A100 ML 최적화
  STORAGE_EFFECT_RATIO: 0.20,
  // 보관 효과 중첩 상한 (같은 효과 타입 최대 슬롯)
  STORAGE_STACK_MAX: 3,
  // 합성 비용 (등급-1 인덱스: D→C, C→B, B→A, A→S, S→SS) — v5.0 SS 추가
  FUSE_COST: [3_185, 9_782, 32_528, 130_335, 500_000] as const,
  // 합성 실패 시 최대 반환 재료 수 (0 = 전부 소멸).
  // 실패 반환 로직 구현 시 이 값을 올리고, fuseRelics 실패 경로에서 returnedCount를 설정한다.
  FUSE_MAX_FAIL_RETURN: 0,
  // 드랍 확률 (메인게임 성공 시) — v3.6 A100 ML 최적화
  DROP_RATES: {
    1: 0.044121,  // D 4.4121%
    2: 0.035000,  // C 3.5000%
    3: 0.004788,  // B 0.4788%
    4: 0.000833,  // A 0.0833%
    5: 0,         // S:  드랍 없음 (합성으로만)
    6: 0,         // SS: 드랍 없음 (합성으로만)
  } as Record<RelicGrade, number>,
} as const;

// ── DB 타입 ───────────────────────────────────────────────────────────────
export interface RelicRow {
  relicId:          number;
  ownerId:          string;
  typeId:           number;
  grade:            RelicGrade;
  level:            number;
  enhance:          number;
  exp:              number;
  isMain:           boolean;
  effectValue:      number;
  createdAt:        Date;
  relicAssetValue:  number;
}

// ── 실효 전투력 타입 ────────────────────────────────────────────────────────
export interface EffectivePowerStats {
  totalPower:          number;
  mainPower:           number;
  storagePowerApplied: number;
  storageApplyRate:    number;
  hasSSMain:           boolean;  // 메인 유물이 SS등급인지
  hasSSStorage:        boolean;  // 보관함에 SS등급 유물이 있는지
}

// ── 이미지 URL ────────────────────────────────────────────────────────────
const RELIC_IMAGE_VERSION = 2; // 이미지 교체 시 올려서 캐시 무효화

export function getNewRelicImageUrl(typeId: number, grade: RelicGrade): string {
  const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === typeId);
  if (!typeDef) return '';
  const imgNum = typeDef.images[grade - 1];
  const pad    = String(imgNum).padStart(2, '0');
  return `${ITEM_BASE_URL}/items/item_${pad}.png?v=${RELIC_IMAGE_VERSION}`;
}

// ── 유물 이름 ─────────────────────────────────────────────────────────────
export function getRelicName(typeId: number, grade: RelicGrade): string {
  const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === typeId);
  if (!typeDef) return '알 수 없는 유물';
  return typeDef.gradeNames[grade - 1];
}

// ── 효과값 계산 ──────────────────────────────────────────────────────────
export function calcEffectValue(grade: RelicGrade, level: number, enhance: number): number {
  const base     = RELIC_CONFIG.BASE_EFFECT[grade - 1];
  const lvBonus  = 1 + (level - 1) * RELIC_CONFIG.LEVEL_BONUS_PER_LEVEL;
  const enhBonus = 1 + enhance * RELIC_CONFIG.ENHANCE_BONUS_PER_ENHANCE;
  return Math.round(base * lvBonus * enhBonus * 10) / 10;
}

// ── 비용 계산 ─────────────────────────────────────────────────────────────
export function calcLevelUpCost(grade: RelicGrade, currentLevel: number): number {
  return grade * RELIC_CONFIG.LEVEL_UP_COST_FACTOR * currentLevel;
}

export function calcEnhanceCost(grade: RelicGrade, currentEnhance: number, costReducePct = 0): number {
  const base = Math.floor(grade * RELIC_CONFIG.ENHANCE_COST_BASE * Math.pow(RELIC_CONFIG.ENHANCE_COST_GROWTH, currentEnhance));
  return Math.floor(base * (1 - costReducePct / 100));
}

// ── DB 초기화 ─────────────────────────────────────────────────────────────
export async function initRelicTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relic_types (
      type_id     INTEGER PRIMARY KEY,
      type_name   VARCHAR(50)  NOT NULL,
      description VARCHAR(200) NOT NULL,
      effect_type VARCHAR(50)  NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS relics (
      relic_id    BIGSERIAL PRIMARY KEY,
      owner_id    VARCHAR(255) NOT NULL,
      type_id     INTEGER      NOT NULL,
      grade       SMALLINT     NOT NULL DEFAULT 1,
      level       SMALLINT     NOT NULL DEFAULT 1,
      enhance     SMALLINT     NOT NULL DEFAULT 0,
      exp         INTEGER      NOT NULL DEFAULT 0,
      is_main     BOOLEAN      NOT NULL DEFAULT FALSE,
      effect_value DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_relics_owner   ON relics (owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_relics_main    ON relics (owner_id, is_main)`);

  // 유물 자산가치 컬럼 추가 (이미 존재하면 무시)
  await pool.query(`ALTER TABLE relics ADD COLUMN IF NOT EXISTS base_asset_value        BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE relics ADD COLUMN IF NOT EXISTS enhance_cost_total      BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE relics ADD COLUMN IF NOT EXISTS levelup_cost_total      BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE relics ADD COLUMN IF NOT EXISTS synthesis_inherited_value BIGINT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE relics ADD COLUMN IF NOT EXISTS relic_asset_value       BIGINT NOT NULL DEFAULT 0`);

  // relic_types 시딩
  const { rows } = await pool.query<{ c: string }>(`SELECT COUNT(*) AS c FROM relic_types`);
  if (parseInt(rows[0].c) < RELIC_TYPE_CATALOG.length) {
    for (const t of RELIC_TYPE_CATALOG) {
      await pool.query(
        `INSERT INTO relic_types (type_id, type_name, description, effect_type) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [t.typeId, t.typeName, t.description, t.effectType],
      );
    }
  }
}

// ── 기존 유물 자산가치 일괄 마이그레이션 (서버 시작 시 1회 실행) ──────────────
export async function migrateRelicAssets(): Promise<number> {
  const { rows } = await pool.query<{
    relic_id: string; grade: string; enhance: string; level: string;
  }>(
    `SELECT relic_id, grade, enhance, level FROM relics WHERE relic_asset_value = 0`,
  );
  if (rows.length === 0) return 0;

  let updated = 0;
  for (const r of rows) {
    const grade   = Number(r.grade) as RelicGrade;
    const enhance = Number(r.enhance);
    const level   = Number(r.level);

    const baseAsset = RELIC_CONFIG.DISMANTLE_REFUND[grade - 1];

    // 강화 누적 비용 역산 (실제 할인 내역 불명이므로 명목 비용으로 추정)
    let enhanceCostTotal = 0;
    for (let i = 0; i < enhance; i++) {
      enhanceCostTotal += Math.floor(
        grade * RELIC_CONFIG.ENHANCE_COST_BASE * Math.pow(RELIC_CONFIG.ENHANCE_COST_GROWTH, i),
      );
    }

    // 레벨업 누적 비용: Σ(j=1..level-1) grade×705×j = grade×705×(level-1)×level/2
    const levelupCostTotal = Math.floor(
      grade * RELIC_CONFIG.LEVEL_UP_COST_FACTOR * (level - 1) * level / 2,
    );

    const relicAssetValue = baseAsset + enhanceCostTotal + levelupCostTotal;

    await pool.query(
      `UPDATE relics
       SET base_asset_value        = $1,
           enhance_cost_total      = $2,
           levelup_cost_total      = $3,
           synthesis_inherited_value = 0,
           relic_asset_value       = $4
       WHERE relic_id = $5`,
      [baseAsset, enhanceCostTotal, levelupCostTotal, relicAssetValue, Number(r.relic_id)],
    );
    updated++;
  }
  return updated;
}

// ── 시작 시 effect_value 자동 재계산 ──────────────────────────────────────
export async function recalcAllRelicEffects(): Promise<number> {
  // grade=6(SS) 유물만 재계산 — 기존 D~S 유물은 소급 변경하지 않음
  // D~S BASE_EFFECT 변경은 신규 생성/강화/레벨업 시점부터만 적용됨
  const result = await pool.query<{ relic_id: number }>(
    `UPDATE relics
     SET effect_value = ROUND((
       ${RELIC_CONFIG.BASE_EFFECT[5]}
       * (1.0 + (level - 1) * ${RELIC_CONFIG.LEVEL_BONUS_PER_LEVEL})
       * (1.0 + enhance * ${RELIC_CONFIG.ENHANCE_BONUS_PER_ENHANCE})
     )::numeric, 1)
     WHERE grade = 6
     RETURNING relic_id`
  );
  return result.rowCount ?? 0;
}

// ── 유물 조회 ─────────────────────────────────────────────────────────────
async function queryRelics(ownerId: string): Promise<RelicRow[]> {
  const { rows } = await pool.query(
    `SELECT relic_id, owner_id, type_id, grade, level, enhance, exp, is_main, effect_value, created_at,
            COALESCE(relic_asset_value, 0) AS relic_asset_value
     FROM relics WHERE owner_id = $1 ORDER BY is_main DESC, grade DESC, level DESC, relic_id ASC`,
    [ownerId],
  );
  return rows.map(r => ({
    relicId:         Number(r.relic_id),
    ownerId:         r.owner_id,
    typeId:          Number(r.type_id),
    grade:           Number(r.grade) as RelicGrade,
    level:           Number(r.level),
    enhance:         Number(r.enhance),
    exp:             Number(r.exp),
    isMain:          Boolean(r.is_main),
    effectValue:     Number(r.effect_value),
    createdAt:       r.created_at,
    relicAssetValue: Number(r.relic_asset_value ?? 0),
  }));
}

export async function getUserRelics(userId: string): Promise<RelicRow[]> {
  return queryRelics(userId);
}

export async function getUserInventory(userId: string, invLimit: number): Promise<{
  relics: RelicRow[];
  mainRelic: RelicRow | null;
  storageRelics: RelicRow[];
  capacity: number;
}> {
  const relics       = await queryRelics(userId);
  const mainRelic    = relics.find(r => r.isMain) ?? null;
  const storageRelics = relics.filter(r => !r.isMain);
  return { relics, mainRelic, storageRelics, capacity: invLimit };
}

// ── 유물 드랍 ─────────────────────────────────────────────────────────────
// ── 유물 뽑기 확정 생성 (가챠, 항상 D등급 1개 지급) ─────────────────────
export async function createGachaRelic(userId: string): Promise<RelicRow> {
  // 항상 D등급(1) 고정
  const grade: RelicGrade = 1;

  const typeDef     = RELIC_TYPE_CATALOG[Math.floor(Math.random() * RELIC_TYPE_CATALOG.length)];
  const effectValue = calcEffectValue(grade, 1, 0);
  const baseAsset   = RELIC_CONFIG.DISMANTLE_REFUND[grade - 1];

  const { rows } = await pool.query(
    `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value,
                         base_asset_value, relic_asset_value)
     VALUES ($1, $2, $3, 1, 0, 0, FALSE, $4, $5, $5) RETURNING relic_id`,
    [userId, typeDef.typeId, grade, effectValue, baseAsset],
  );
  const relicId = Number(rows[0].relic_id);
  return {
    relicId, ownerId: userId, typeId: typeDef.typeId, grade, level: 1, enhance: 0,
    exp: 0, isMain: false, effectValue, createdAt: new Date(), relicAssetValue: baseAsset,
  };
}

/** 이벤트 전용 유물 생성 — 지정 등급 고정, 타입 랜덤 */
export async function createEventRelic(userId: string, grade: RelicGrade): Promise<RelicRow> {
  const typeDef     = RELIC_TYPE_CATALOG[Math.floor(Math.random() * RELIC_TYPE_CATALOG.length)];
  const effectValue = calcEffectValue(grade, 1, 0);
  const baseAsset   = RELIC_CONFIG.DISMANTLE_REFUND[grade - 1];

  const { rows } = await pool.query(
    `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value,
                         base_asset_value, relic_asset_value)
     VALUES ($1, $2, $3, 1, 0, 0, FALSE, $4, $5, $5) RETURNING relic_id`,
    [userId, typeDef.typeId, grade, effectValue, baseAsset],
  );
  const relicId = Number(rows[0].relic_id);
  return {
    relicId, ownerId: userId, typeId: typeDef.typeId, grade, level: 1, enhance: 0,
    exp: 0, isMain: false, effectValue, createdAt: new Date(), relicAssetValue: baseAsset,
  };
}

export async function tryDropRelic(
  userId: string,
): Promise<RelicRow | null> {
  // 등급 결정
  let grade: RelicGrade | null = null;
  const rand = Math.random();
  let cumulative = 0;
  for (const [g, rate] of Object.entries(RELIC_CONFIG.DROP_RATES) as [string, number][]) {
    cumulative += rate;
    if (rand < cumulative) { grade = Number(g) as RelicGrade; break; }
  }
  if (!grade) return null;

  // 타입 결정 (랜덤)
  const typeDef     = RELIC_TYPE_CATALOG[Math.floor(Math.random() * RELIC_TYPE_CATALOG.length)];
  const effectValue = calcEffectValue(grade, 1, 0);
  const baseAsset   = RELIC_CONFIG.DISMANTLE_REFUND[grade - 1];

  const { rows } = await pool.query(
    `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value,
                         base_asset_value, relic_asset_value)
     VALUES ($1, $2, $3, 1, 0, 0, FALSE, $4, $5, $5) RETURNING relic_id`,
    [userId, typeDef.typeId, grade, effectValue, baseAsset],
  );
  const relicId = Number(rows[0].relic_id);

  // 모니터링 이벤트 로그
  logEvent('drop', userId, grade, `grade${grade}`);

  return {
    relicId, ownerId: userId, typeId: typeDef.typeId, grade, level: 1, enhance: 0,
    exp: 0, isMain: false, effectValue, createdAt: new Date(), relicAssetValue: baseAsset,
  };
}

// ── 메인 유물 설정 ────────────────────────────────────────────────────────
export async function setMainRelic(userId: string, relicId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE relics SET is_main = FALSE WHERE owner_id = $1`, [userId]);
    const { rowCount } = await client.query(
      `UPDATE relics SET is_main = TRUE WHERE relic_id = $1 AND owner_id = $2`,
      [relicId, userId],
    );
    if ((rowCount ?? 0) === 0) {
      // 대상 유물이 존재하지 않거나 소유자 불일치 → 메인 해제만 된 상태 방지
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch {
    await client.query('ROLLBACK');
    return false;
  } finally {
    client.release();
  }
}

// ── 유물 강화 ─────────────────────────────────────────────────────────────
export interface EnhanceResult {
  ok:           boolean;
  errorMsg?:    string;
  result?:      'success' | 'fail';
  enhanceBefore: number;
  enhanceAfter:  number;
  cost:          number;
  effectBefore:  number;
  effectAfter:   number;
  relic?:        RelicRow;
}

export async function enhanceRelic(
  userId:       string,
  nickname:     string,
  relicId:      number,
  userScore:    number,
  costReducePct: number,
  deductFn:     (userId: string, nick: string, amount: number) => boolean,
): Promise<EnhanceResult> {
  const { rows } = await pool.query(
    `SELECT * FROM relics WHERE relic_id = $1 AND owner_id = $2`,
    [relicId, userId],
  );
  if (!rows.length) return { ok: false, errorMsg: '유물을 찾을 수 없어요.', enhanceBefore: 0, enhanceAfter: 0, cost: 0, effectBefore: 0, effectAfter: 0 };
  const relic = rows[0];
  const grade   = Number(relic.grade) as RelicGrade;
  const enhance = Number(relic.enhance);
  const level   = Number(relic.level);

  if (enhance >= RELIC_CONFIG.MAX_ENHANCE) {
    return { ok: false, errorMsg: `이미 최대 강화 단계(${RELIC_CONFIG.MAX_ENHANCE}강)예요.`, enhanceBefore: enhance, enhanceAfter: enhance, cost: 0, effectBefore: calcEffectValue(grade, level, enhance), effectAfter: calcEffectValue(grade, level, enhance) };
  }

  const cost = calcEnhanceCost(grade, enhance, costReducePct);
  if (!deductFn(userId, nickname, cost)) {
    return { ok: false, errorMsg: `포인트가 부족해요. 필요: ${cost.toLocaleString('ko-KR')}P`, enhanceBefore: enhance, enhanceAfter: enhance, cost, effectBefore: calcEffectValue(grade, level, enhance), effectAfter: calcEffectValue(grade, level, enhance) };
  }

  const successRate = RELIC_CONFIG.ENHANCE_SUCCESS_RATE[enhance];
  const success     = Math.random() * 100 < successRate;
  const newEnhance  = success ? enhance + 1 : enhance;
  const newEffect   = calcEffectValue(grade, level, newEnhance);

  await pool.query(`UPDATE relics SET enhance = $1, effect_value = $2 WHERE relic_id = $3`, [newEnhance, newEffect, relicId]);

  // 강화 비용(실제 지불액)을 자산가치에 누적 — 성공/실패 무관하게 지불한 포인트는 자산으로 인정
  await pool.query(
    `UPDATE relics
     SET enhance_cost_total = enhance_cost_total + $1,
         relic_asset_value  = relic_asset_value  + $1
     WHERE relic_id = $2`,
    [cost, relicId],
  );

  // 모니터링 이벤트 로그
  logEvent('enhance_try', userId, cost);
  logEvent(success ? 'enhance_ok' : 'enhance_fail', userId, 0, `${enhance}→${newEnhance}`);

  return {
    ok:            true,
    result:        success ? 'success' : 'fail',
    enhanceBefore: enhance,
    enhanceAfter:  newEnhance,
    cost,
    effectBefore:  calcEffectValue(grade, level, enhance),
    effectAfter:   newEffect,
  };
}

// ── 유물 레벨업 ──────────────────────────────────────────────────────────
export interface LevelUpResult {
  ok:           boolean;
  errorMsg?:    string;
  levelBefore:  number;
  levelAfter:   number;
  cost:         number;
  effectBefore: number;
  effectAfter:  number;
}

export async function levelUpRelic(
  userId:   string,
  nickname: string,
  relicId:  number,
  deductFn: (userId: string, nick: string, amount: number) => boolean,
): Promise<LevelUpResult> {
  const { rows } = await pool.query(`SELECT * FROM relics WHERE relic_id = $1 AND owner_id = $2`, [relicId, userId]);
  if (!rows.length) return { ok: false, errorMsg: '유물을 찾을 수 없어요.', levelBefore: 0, levelAfter: 0, cost: 0, effectBefore: 0, effectAfter: 0 };
  const relic   = rows[0];
  const grade   = Number(relic.grade) as RelicGrade;
  const level   = Number(relic.level);
  const enhance = Number(relic.enhance);

  if (level >= RELIC_CONFIG.MAX_LEVEL) {
    return { ok: false, errorMsg: `이미 최대 레벨(${RELIC_CONFIG.MAX_LEVEL}Lv)이에요.`, levelBefore: level, levelAfter: level, cost: 0, effectBefore: calcEffectValue(grade, level, enhance), effectAfter: calcEffectValue(grade, level, enhance) };
  }

  const cost = calcLevelUpCost(grade, level);
  if (!deductFn(userId, nickname, cost)) {
    return { ok: false, errorMsg: `포인트가 부족해요. 필요: ${cost.toLocaleString('ko-KR')}P`, levelBefore: level, levelAfter: level, cost, effectBefore: calcEffectValue(grade, level, enhance), effectAfter: calcEffectValue(grade, level, enhance) };
  }

  const newLevel  = level + 1;
  const newEffect = calcEffectValue(grade, newLevel, enhance);
  await pool.query(`UPDATE relics SET level = $1, effect_value = $2 WHERE relic_id = $3`, [newLevel, newEffect, relicId]);

  // 레벨업 비용(실제 지불액)을 자산가치에 누적
  await pool.query(
    `UPDATE relics
     SET levelup_cost_total = levelup_cost_total + $1,
         relic_asset_value  = relic_asset_value  + $1
     WHERE relic_id = $2`,
    [cost, relicId],
  );

  return { ok: true, levelBefore: level, levelAfter: newLevel, cost, effectBefore: calcEffectValue(grade, level, enhance), effectAfter: newEffect };
}


// ── 유물 판매 (구 분해) ──────────────────────────────────────────────────
export async function sellRelic(
  userId: string,
  relicId: number,
  /** true = 호출자가 메인 유물을 명시적으로 대상으로 선택한 경우 (ID 생략 → 메인 자동 적용 경로) */
  allowMain = false,
): Promise<{ ok: boolean; refund: number; typeId?: number; grade?: RelicGrade; enhance?: number; level?: number; effectValue?: number; errorMsg?: string }> {
  const { rows } = await pool.query(`SELECT * FROM relics WHERE relic_id = $1 AND owner_id = $2`, [relicId, userId]);
  if (!rows.length) return { ok: false, refund: 0, errorMsg: '유물을 찾을 수 없어요.' };
  const relic = rows[0];
  if (!allowMain && relic.is_main) return { ok: false, refund: 0, errorMsg: '메인 유물은 판매할 수 없어요. 먼저 메인 유물을 변경해주세요.' };
  const grade       = Number(relic.grade) as RelicGrade;
  const typeId      = Number(relic.type_id);
  const enhance     = Number(relic.enhance ?? 0);
  const level       = Number(relic.level ?? 1);
  const effectValue = Number(relic.effect_value ?? 0);

  // 강화 누적 비용 합산: Σ(i=0 to enhance-1) floor(grade * BASE * GROWTH^i)
  let enhanceCumCost = 0;
  for (let i = 0; i < enhance; i++) {
    enhanceCumCost += Math.floor(
      grade * RELIC_CONFIG.ENHANCE_COST_BASE * Math.pow(RELIC_CONFIG.ENHANCE_COST_GROWTH, i),
    );
  }
  const refund = RELIC_CONFIG.DISMANTLE_REFUND[grade - 1] + enhanceCumCost;
  await pool.query(`DELETE FROM relics WHERE relic_id = $1`, [relicId]);
  return { ok: true, refund, typeId, grade, enhance, level, effectValue };
}

// ── 유물 분해 (하위 등급 2개 생성) ───────────────────────────────────────
export async function dismantleRelic(
  userId: string,
  relicId: number,
  /** true = 호출자가 메인 유물을 명시적으로 대상으로 선택한 경우 (ID 생략 → 메인 자동 적용 경로) */
  allowMain = false,
): Promise<{ ok: boolean; newRelics?: RelicRow[]; dismantledTypeId?: number; dismantledGrade?: RelicGrade; errorMsg?: string }> {
  const { rows } = await pool.query(`SELECT * FROM relics WHERE relic_id = $1 AND owner_id = $2`, [relicId, userId]);
  if (!rows.length) return { ok: false, errorMsg: '유물을 찾을 수 없어요.' };
  const relic = rows[0];
  if (!allowMain && relic.is_main) return { ok: false, errorMsg: '메인 유물은 분해할 수 없어요. 먼저 메인 유물을 변경해주세요.' };
  const grade = Number(relic.grade) as RelicGrade;
  if (grade <= 1) return { ok: false, errorMsg: 'D등급 유물은 더 이상 분해할 수 없어요. (최하 등급)' };

  const dismantledTypeId = Number(relic.type_id);
  const dismantledGrade  = grade;
  const lowerGrade = (grade - 1) as RelicGrade;

  // 원본 유물 삭제
  await pool.query(`DELETE FROM relics WHERE relic_id = $1`, [relicId]);

  // 하위 등급 랜덤 유물 2개 생성
  const lowerBaseAsset = RELIC_CONFIG.DISMANTLE_REFUND[lowerGrade - 1];
  const newRelics: RelicRow[] = [];
  for (let i = 0; i < 2; i++) {
    const typeDef     = RELIC_TYPE_CATALOG[Math.floor(Math.random() * RELIC_TYPE_CATALOG.length)];
    const effectValue = calcEffectValue(lowerGrade, 1, 0);
    const { rows: ins } = await pool.query(
      `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value,
                           base_asset_value, relic_asset_value)
       VALUES ($1, $2, $3, 1, 0, 0, FALSE, $4, $5, $5) RETURNING relic_id`,
      [userId, typeDef.typeId, lowerGrade, effectValue, lowerBaseAsset],
    );
    newRelics.push({
      relicId: Number(ins[0].relic_id),
      ownerId: userId,
      typeId: typeDef.typeId,
      grade: lowerGrade,
      level: 1,
      enhance: 0,
      exp: 0,
      isMain: false,
      effectValue,
      createdAt: new Date(),
      relicAssetValue: lowerBaseAsset,
    });
  }

  return { ok: true, newRelics, dismantledTypeId, dismantledGrade };
}

// ── 보관함 확장 ───────────────────────────────────────────────────────────
export async function expandInventory(
  userId:       string,
  nickname:     string,
  currentLimit: number,
  deductFn:     (userId: string, nick: string, amount: number) => boolean,
): Promise<{ ok: boolean; errorMsg?: string; newLimit: number; cost: number }> {
  if (currentLimit >= RELIC_CONFIG.INVENTORY_EXPAND_MAX) {
    return { ok: false, errorMsg: `보관함이 최대 크기(${RELIC_CONFIG.INVENTORY_EXPAND_MAX}칸)예요.`, newLimit: currentLimit, cost: 0 };
  }
  const cost = RELIC_CONFIG.INVENTORY_EXPAND_COST;
  if (!deductFn(userId, nickname, cost)) {
    return { ok: false, errorMsg: `포인트가 부족해요. 필요: ${cost.toLocaleString('ko-KR')}P`, newLimit: currentLimit, cost };
  }
  const newLimit = currentLimit + 1;
  await pool.query(`UPDATE users SET relic_inv_limit = $1 WHERE user_id = $2`, [newLimit, userId]);
  // 모니터링 이벤트 로그
  logEvent('expand', userId, cost);
  return { ok: true, newLimit, cost };
}

// ── 유물 효과 집계 ────────────────────────────────────────────────────────
export interface RelicEffects {
  allBonus:           number; // % 보너스
  chosungBonus:       number;
  hunminBonus:        number;
  jamoBonus:          number;
  comboBonus:         number;
  enhanceCostReduce:  number;
  expBonus:           number;
  storageBonus:       number;
}

export async function getRelicEffects(userId: string): Promise<RelicEffects> {
  const effects: RelicEffects = {
    allBonus: 0, chosungBonus: 0, hunminBonus: 0, jamoBonus: 0,
    comboBonus: 0, enhanceCostReduce: 0, expBonus: 0, storageBonus: 0,
  };

  const relics = await getUserRelics(userId);
  if (!relics.length) return effects;

  const mainRelic   = relics.find(r => r.isMain);
  const storageRelics = relics.filter(r => !r.isMain);

  // 스택 카운트 (같은 효과타입 최대 STORAGE_STACK_MAX개)
  const stackCount: Record<string, number> = {};

  function applyEffect(typeDef: RelicTypeDef | undefined, value: number) {
    if (!typeDef) return;
    switch (typeDef.effectType) {
      case 'all_bonus':            effects.allBonus           += value; break;
      case 'chosung_bonus':        effects.chosungBonus        += value; break;
      case 'hunmin_bonus':         effects.hunminBonus         += value; break;
      case 'jamo_bonus':           effects.jamoBonus           += value; break;
      case 'combo_bonus':          effects.comboBonus          += value; break;
      case 'enhance_cost_reduce':  effects.enhanceCostReduce   += value; break;
      case 'exp_bonus':            effects.expBonus            += value; break;
      case 'storage_bonus':        effects.storageBonus        += value; break;
    }
  }

  // 메인 유물 100% 효과
  if (mainRelic) {
    const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === mainRelic.typeId);
    applyEffect(typeDef, mainRelic.effectValue);
    // SS 이중 효과: 주 효과 외 all_bonus 50% 추가 — v5.1 30%→50% 상향
    if (mainRelic.grade === 6) {
      effects.allBonus += mainRelic.effectValue * 0.50;
    }
  }

  // 보관 유물 20% 효과 (중첩 상한)
  for (const r of storageRelics) {
    const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
    if (!typeDef) continue;
    const key = typeDef.effectType;
    stackCount[key] = (stackCount[key] ?? 0) + 1;
    if (stackCount[key] > RELIC_CONFIG.STORAGE_STACK_MAX) continue;
    const sv = r.effectValue * RELIC_CONFIG.STORAGE_EFFECT_RATIO;
    applyEffect(typeDef, sv);
    // SS 이중 효과: 보관 유물도 all_bonus 50% 추가 (보관 배율 적용 후) — v5.1 상향
    if (r.grade === 6) {
      effects.allBonus += sv * 0.50;
    }
  }

  // 소수점 1자리 반올림
  for (const k of Object.keys(effects) as (keyof RelicEffects)[]) {
    effects[k] = Math.round(effects[k] * 10) / 10;
  }

  return effects;
}

// ── 유물 효과 집계 + 메인/보관함 기여도 분리 ────────────────────────────────
export interface RelicEffectsDetailed {
  effects:    RelicEffects;
  mainPct:    number; // 메인 유물이 기여하는 게임 관련 효과 합계 (%)
  storagePct: number; // 보관함 유물이 기여하는 효과 합계 (%)
}

export async function getRelicEffectsDetailed(
  userId:          string,
  gameEffectTypes: RelicEffectType[],
): Promise<RelicEffectsDetailed> {
  const effects: RelicEffects = {
    allBonus: 0, chosungBonus: 0, hunminBonus: 0, jamoBonus: 0,
    comboBonus: 0, enhanceCostReduce: 0, expBonus: 0, storageBonus: 0,
  };

  const relics = await getUserRelics(userId);
  if (!relics.length) return { effects, mainPct: 0, storagePct: 0 };

  const mainRelic     = relics.find(r => r.isMain);
  const storageRelics = relics.filter(r => !r.isMain);
  const relevant      = new Set<string>(gameEffectTypes);
  const stackCount: Record<string, number> = {};
  let mainPct    = 0;
  let storagePct = 0;

  function apply(td: RelicTypeDef | undefined, value: number) {
    if (!td) return;
    switch (td.effectType) {
      case 'all_bonus':            effects.allBonus           += value; break;
      case 'chosung_bonus':        effects.chosungBonus        += value; break;
      case 'hunmin_bonus':         effects.hunminBonus         += value; break;
      case 'jamo_bonus':           effects.jamoBonus           += value; break;
      case 'combo_bonus':          effects.comboBonus          += value; break;
      case 'enhance_cost_reduce':  effects.enhanceCostReduce   += value; break;
      case 'exp_bonus':            effects.expBonus            += value; break;
      case 'storage_bonus':        effects.storageBonus        += value; break;
    }
  }

  if (mainRelic) {
    const td = RELIC_TYPE_CATALOG.find(t => t.typeId === mainRelic.typeId);
    apply(td, mainRelic.effectValue);
    if (td && relevant.has(td.effectType)) mainPct += mainRelic.effectValue;
    // SS 이중 효과: 주 효과 외 all_bonus 50% 추가 — v5.1 30%→50% 상향
    if (mainRelic.grade === 6) {
      effects.allBonus += mainRelic.effectValue * 0.50;
      if (relevant.has('all_bonus')) mainPct += mainRelic.effectValue * 0.50;
    }
  }

  for (const r of storageRelics) {
    const td = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
    if (!td) continue;
    stackCount[td.effectType] = (stackCount[td.effectType] ?? 0) + 1;
    if (stackCount[td.effectType] > RELIC_CONFIG.STORAGE_STACK_MAX) continue;
    const sv = r.effectValue * RELIC_CONFIG.STORAGE_EFFECT_RATIO;
    apply(td, sv);
    if (relevant.has(td.effectType)) storagePct += sv;
    // SS 이중 효과: 보관 유물도 all_bonus 50% 추가 (보관 배율 적용 후) — v5.1 상향
    if (r.grade === 6) {
      effects.allBonus += sv * 0.50;
      if (relevant.has('all_bonus')) storagePct += sv * 0.50;
    }
  }

  for (const k of Object.keys(effects) as (keyof RelicEffects)[]) {
    effects[k] = Math.round(effects[k] * 10) / 10;
  }

  return {
    effects,
    mainPct:    Math.round(mainPct    * 10) / 10,
    storagePct: Math.round(storagePct * 10) / 10,
  };
}

// ── 유물 정보 포맷 ────────────────────────────────────────────────────────
export function formatRelicInfo(r: RelicRow): string {
  const typeDef   = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
  const name      = getRelicName(r.typeId, r.grade);
  const baseEffect = typeDef ? `${typeDef.description} +${r.effectValue}%` : '';
  const ssExtra   = r.grade === 6
    ? ` + 전체 보너스 +${Math.round(r.effectValue * 0.50 * 10) / 10}%`
    : '';
  return `${GRADE_STARS[r.grade]} [${GRADE_NAMES[r.grade]}] ${name} Lv.${r.level} (+${r.enhance}) — ${baseEffect}${ssExtra}`;
}

// ── 보관함 슬롯 체크 (메인 유물 제외) ────────────────────────────────────
export async function getRelicCount(userId: string): Promise<number> {
  const { rows } = await pool.query(`SELECT COUNT(*) AS c FROM relics WHERE owner_id = $1 AND is_main = FALSE`, [userId]);
  return parseInt(rows[0].c);
}

// ── 보관함 한도 — DB 직접 조회 (eval 등 외부 업데이트 후 캐시 stale 방지) ──
export async function getRelicInvLimitDB(userId: string): Promise<number> {
  const { rows } = await pool.query(`SELECT relic_inv_limit FROM users WHERE user_id = $1`, [userId]);
  return Number(rows[0]?.relic_inv_limit ?? 8);
}

// ── 유물 합성 — 성공률 계산 헬퍼 ──────────────────────────────────────────
// avgGrade×15 + avgEnhance×5 + (count-1)×8, 범위 5~95%
export function calcFuseSuccessRate(
  materials: Array<{ grade: number; enhance: number }>,
): number {
  if (materials.length === 0) return 0;
  const count      = materials.length;
  const avgGrade   = materials.reduce((s, r) => s + r.grade, 0) / count;
  // enhance는 합성 성공률 계산에서 0~5로 제한 (실제 최대강화는 20이지만 기여 상한은 5)
  // 평균 대신 최대값 사용 — 낮은 강화 유물 추가 시 성공률이 떨어지는 버그 수정
  const maxEnhance = Math.max(...materials.map(r => Math.min(5, Math.max(0, r.enhance))));

  const baseProb   = avgGrade   * 15;
  const enhBonus   = maxEnhance * 5;
  const countBonus = (count - 1) * 8;

  // fuse_success_scale:0.5303 적용 — v4.1 1.2배 버프 (0.4419 × 1.2) / v5.1 +1%p
  const raw = Math.min(95, Math.max(5, Math.round((baseProb + enhBonus + countBonus) * 0.5303) + 3));
  // A·S 등급 생성(재료 B=3, A=4)은 -1%p 조정
  const penalty = avgGrade >= 3 && avgGrade <= 4 ? 1 : 0;
  return Math.max(5, raw - penalty);
}

// ── SS 합성 전용 성공률 계산 (S등급 재료 최강 기준 최대 ~45%) ──────────────
export function calcSSFuseSuccessRate(
  materials: Array<{ grade: number; enhance: number }>,
): number {
  if (materials.length === 0) return 0;
  const count      = materials.length;
  const avgGrade   = materials.reduce((s, r) => s + r.grade, 0) / count;
  const maxEnhance = Math.max(...materials.map(r => Math.min(5, Math.max(0, r.enhance))));

  const baseProb   = avgGrade   * 15;
  const enhBonus   = maxEnhance * 5;
  const countBonus = (count - 1) * 8;

  // scale 0.22, cap 46% — v5.1 +1%p 상향, 최대 46%
  return Math.min(46, Math.max(5, Math.round((baseProb + enhBonus + countBonus) * 0.22) + 3));
}

// ── 유물 합성 (같은 등급 N개 → 확률 판정 → 상위 등급 1개) ────────────────
export interface FuseResult {
  ok:             boolean;   // 입력/DB 오류 없이 실행됐는지
  success?:       boolean;   // 확률 판정 성공 여부
  successRate?:   number;    // 굴린 성공률 (%)
  errorMsg?:      string;
  newRelic?:      RelicRow;
  consumedIds?:   number[];
  returnedCount?: number;    // 실패 시 보관함으로 돌아온 재료 수 (0 = 전부 소멸)
  gradeBefore?:   RelicGrade;
  gradeAfter?:    RelicGrade;
  pointCost?:     number;
}

export async function fuseRelics(
  userId:   string,
  nickname: string,
  relicIds: number[],
  deductFn: (userId: string, nick: string, amount: number) => boolean,
  refundFn: (userId: string, nick: string, amount: number) => void,
): Promise<FuseResult> {
  if (relicIds.length < 1) {
    return { ok: false, errorMsg: '합성할 유물을 1개 이상 선택해야 해요.' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE로 row-level 잠금 → 동시 합성 요청 중복 방지
    const { rows } = await client.query(
      `SELECT * FROM relics WHERE relic_id = ANY($1) AND owner_id = $2 FOR UPDATE`,
      [relicIds, userId],
    );

    if (rows.length !== relicIds.length) {
      await client.query('ROLLBACK');
      return { ok: false, errorMsg: '선택한 유물 중 일부를 찾을 수 없어요. 번호를 다시 확인해주세요.' };
    }

    if (rows.some((r: { is_main: boolean }) => r.is_main)) {
      await client.query('ROLLBACK');
      return { ok: false, errorMsg: '메인 유물은 합성에 사용할 수 없어요.' };
    }

    const grades  = rows.map((r: { grade: number })   => Number(r.grade));
    const grade   = grades[0] as RelicGrade;
    if (grades.some(g => g !== grade)) {
      await client.query('ROLLBACK');
      const gradeLabels = grades.map((g: number) => GRADE_NAMES[g as RelicGrade]).join(', ');
      return { ok: false, errorMsg: `합성은 같은 등급 유물만 사용할 수 있어요.\n선택한 등급: ${gradeLabels}` };
    }

    if (grade >= 6) {
      await client.query('ROLLBACK');
      return { ok: false, errorMsg: 'SS등급 유물은 이미 최상위라 합성할 수 없어요.' };
    }

    // S→SS 합성은 최소 재료 3개 필수 (서버사이드 방어)
    if (grade === 5 && relicIds.length < 3) {
      await client.query('ROLLBACK');
      return { ok: false, errorMsg: 'S→SS 합성은 S등급 유물이 최소 3개 필요해요.' };
    }

    // 포인트 비용 차감
    const fuseCost = RELIC_CONFIG.FUSE_COST[grade - 1];
    if (!deductFn(userId, nickname, fuseCost)) {
      await client.query('ROLLBACK');
      return { ok: false, errorMsg: `포인트가 부족해요. 합성 비용: ${fuseCost.toLocaleString('ko-KR')}P` };
    }

    // 성공률 계산 및 확률 판정
    // S→SS 합성은 전용 함수(최대 45%) 사용, 그 외는 일반 합성 함수(최대 95%) 사용
    const enhances    = rows.map((r: { enhance: number }) => Number(r.enhance));
    const materialData = grades.map((g, i) => ({ grade: g, enhance: enhances[i] }));
    const successRate = grade === 5
      ? calcSSFuseSuccessRate(materialData)
      : calcFuseSuccessRate(materialData);
    const succeeded = Math.random() * 100 < successRate;

    // 재료 유물 자산가치 합산 (재료 삭제 전)
    const materialAssetSum = rows.reduce(
      (sum: number, r: { relic_asset_value: string }) => sum + Number(r.relic_asset_value ?? 0),
      0,
    );

    // 재료 삭제 — 소유자 조건 포함
    const { rowCount } = await client.query(
      `DELETE FROM relics WHERE relic_id = ANY($1) AND owner_id = $2`,
      [relicIds, userId],
    );
    if ((rowCount ?? 0) !== relicIds.length) {
      await client.query('ROLLBACK');
      refundFn(userId, nickname, fuseCost);
      return { ok: false, errorMsg: '합성 처리 중 오류가 발생했어요. 다시 시도해주세요.' };
    }

    if (!succeeded) {
      // 확률 실패 — 재료 소모 후 COMMIT, 새 유물 없음
      await client.query('COMMIT');
      logEvent('fuse_fail', userId, fuseCost, `grade${grade}`);
      return { ok: true, success: false, successRate, consumedIds: relicIds, gradeBefore: grade, pointCost: fuseCost };
    }

    // 성공 — 상위 등급 유물 생성
    const newGrade            = (grade + 1) as RelicGrade;
    const typeDef             = RELIC_TYPE_CATALOG[Math.floor(Math.random() * RELIC_TYPE_CATALOG.length)];
    const effectValue         = calcEffectValue(newGrade, 1, 0);
    const newBaseAsset        = RELIC_CONFIG.DISMANTLE_REFUND[newGrade - 1];
    // 재료 자산가치 합계 + 합성 비용을 새 유물에 승계
    const synthInheritedValue = materialAssetSum + fuseCost;
    const newAssetValue       = newBaseAsset + synthInheritedValue;

    const { rows: ins } = await client.query(
      `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value,
                           base_asset_value, synthesis_inherited_value, relic_asset_value)
       VALUES ($1, $2, $3, 1, 0, 0, FALSE, $4, $5, $6, $7) RETURNING relic_id`,
      [userId, typeDef.typeId, newGrade, effectValue, newBaseAsset, synthInheritedValue, newAssetValue],
    );

    await client.query('COMMIT');

    logEvent('fuse_ok', userId, fuseCost, `grade${grade}→${newGrade}`);

    const relicId = Number(ins[0].relic_id);
    const newRelic: RelicRow = {
      relicId, ownerId: userId, typeId: typeDef.typeId, grade: newGrade,
      level: 1, enhance: 0, exp: 0, isMain: false, effectValue, createdAt: new Date(),
      relicAssetValue: newAssetValue,
    };

    return { ok: true, success: true, successRate, newRelic, consumedIds: relicIds, gradeBefore: grade, gradeAfter: newGrade, pointCost: fuseCost };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// fuseCostLabel — 합성 목록 UI에서 RELIC_CONFIG 기반으로 비용 안내 문구 생성
export function fuseCostLabel(): string {
  const c = RELIC_CONFIG.FUSE_COST;
  return `D→C ${c[0].toLocaleString('ko-KR')}P / C→B ${c[1].toLocaleString('ko-KR')}P / B→A ${c[2].toLocaleString('ko-KR')}P / A→S ${c[3].toLocaleString('ko-KR')}P / S→SS ${c[4].toLocaleString('ko-KR')}P`;
}

// ── 유저별 유물 전투력 합산 (메인 + 보관함 모두) ──────────────────────────
// 전투력 공식: 1.0162×grade + 0.03×enhance + 0.8704×effectValue×100
// battleSystem.ts의 BATTLE_CONFIG.grade_weight / enhance_weight / effect_weight 와 동일.
// 순환 참조(battleSystem → newRelicSystem → battleSystem) 방지를 위해 상수를 여기에 인라인.
// ⚠️ battleSystem.ts의 BATTLE_CONFIG 수치를 변경할 경우 이 상수도 함께 업데이트해야 합니다.
const RELIC_POWER_WEIGHTS = {
  grade:   1.0162,  // = BATTLE_CONFIG.grade_weight
  enhance: 0.03,    // = BATTLE_CONFIG.enhance_weight
  effect:  0.8704,  // = BATTLE_CONFIG.effect_weight
} as const;

export async function calcUserRelicPower(userId: string): Promise<number> {
  const { rows } = await pool.query<{ grade: string; enhance: string; effect_value: string }>(
    `SELECT grade, enhance, effect_value FROM relics WHERE owner_id = $1`,
    [userId],
  );
  let total = 0;
  for (const r of rows) {
    total +=
      RELIC_POWER_WEIGHTS.grade   * Number(r.grade) +
      RELIC_POWER_WEIGHTS.enhance * Number(r.enhance) +
      RELIC_POWER_WEIGHTS.effect  * Number(r.effect_value) * 100;
  }
  return Math.round(total * 100) / 100;
}

export interface RelicRankEntry {
  rank:       number;
  userId:     string;
  nickname:   string;
  relicPower: number;
}

export interface CombinedRankEntry {
  rank:          number;
  userId:        string;
  nickname:      string;
  score:         number;
  relicPower:    number;
  effectSum:     number;
  combinedScore: number;
}

export interface RelicStats {
  relicPower: number;
  effectSum:  number;
}

// 전체 유저 유물 전투력 + 효과합산 맵 반환 (bulk, N+1 없음)
export async function getAllUserRelicPowers(): Promise<Map<string, RelicStats>> {
  const { rows } = await pool.query<{ owner_id: string; relic_power: string; effect_sum: string }>(
    `SELECT owner_id,
            SUM(${RELIC_POWER_WEIGHTS.grade} * grade
              + ${RELIC_POWER_WEIGHTS.enhance} * enhance
              + ${RELIC_POWER_WEIGHTS.effect} * effect_value * 100) AS relic_power,
            SUM(effect_value) AS effect_sum
     FROM relics
     GROUP BY owner_id`,
  );
  const map = new Map<string, RelicStats>();
  for (const r of rows) {
    map.set(r.owner_id, {
      relicPower: Math.round(Number(r.relic_power) * 100) / 100,
      effectSum:  Math.round(Number(r.effect_sum)  * 100) / 100,
    });
  }
  return map;
}

// ── 실효 전투력 계산 (메인 100% + 보관 스택 제한 35.31%, 물약 시 추가 증가) ──────
// storage_bonus 적용 방식은 getRelicEffects()와 동일:
//   - 메인 유물이 storage_bonus → storageBonus += effectValue (100%)
//   - 보관 storage_bonus 유물   → storageBonus += effectValue × STORAGE_EFFECT_RATIO (스택 상한 3개)
// effectiveStorageRatio = STORAGE_EFFECT_RATIO + storageBonus / 100
export async function calculateEffectiveBattlePower(userId: string): Promise<EffectivePowerStats> {
  const relics        = await getUserRelics(userId);
  const mainRelic     = relics.find(r => r.isMain);
  const storageRelics = relics.filter(r => !r.isMain);

  const mainPower = mainRelic
    ? RELIC_POWER_WEIGHTS.grade   * mainRelic.grade +
      RELIC_POWER_WEIGHTS.enhance * mainRelic.enhance +
      RELIC_POWER_WEIGHTS.effect  * mainRelic.effectValue * 100
    : 0;

  // ① storageBonus 합산: 메인 유물 100% + 보관 storage_bonus 유물 STORAGE_EFFECT_RATIO%
  let storageBonusPct = 0;
  if (mainRelic) {
    const mainTypeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === mainRelic.typeId);
    if (mainTypeDef?.effectType === 'storage_bonus') {
      storageBonusPct += mainRelic.effectValue;
    }
  }

  // ② 1-pass: 스택 카운트 추적 + 적격 보관 유물 수집 + storage_bonus 합산
  const stackCount: Record<string, number> = {};
  const eligiblePowers: number[] = [];

  for (const r of storageRelics) {
    const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
    if (!typeDef) continue;
    const key = typeDef.effectType;
    stackCount[key] = (stackCount[key] ?? 0) + 1;
    if (stackCount[key] > RELIC_CONFIG.STORAGE_STACK_MAX) continue;
    const singlePower =
      RELIC_POWER_WEIGHTS.grade   * r.grade +
      RELIC_POWER_WEIGHTS.enhance * r.enhance +
      RELIC_POWER_WEIGHTS.effect  * r.effectValue * 100;
    eligiblePowers.push(singlePower);
    if (typeDef.effectType === 'storage_bonus') {
      storageBonusPct += r.effectValue * RELIC_CONFIG.STORAGE_EFFECT_RATIO;
    }
  }

  // ③ 실효 보관 적용률 및 보관 전투력 합산
  const effectiveStorageRatio = RELIC_CONFIG.STORAGE_EFFECT_RATIO + storageBonusPct / 100;
  const storagePowerApplied   = eligiblePowers.reduce((s, p) => s + p * effectiveStorageRatio, 0);

  return {
    totalPower:          Math.round((mainPower + storagePowerApplied) * 100) / 100,
    mainPower:           Math.round(mainPower * 100) / 100,
    storagePowerApplied: Math.round(storagePowerApplied * 100) / 100,
    storageApplyRate:    Math.round(effectiveStorageRatio * 10000) / 10000,
    hasSSMain:           (mainRelic?.grade ?? 0) === 6,
    hasSSStorage:        storageRelics.some(r => r.grade === 6),
  };
}

// 전체 유저 실효 전투력 bulk 조회 (N+1 없음, 스택 규칙 적용)
export async function getAllEffectiveBattlePowers(): Promise<Map<string, EffectivePowerStats>> {
  const { rows } = await pool.query<{
    owner_id: string; type_id: string; grade: string; enhance: string;
    effect_value: string; is_main: boolean;
  }>(
    `SELECT owner_id, type_id, grade, enhance, effect_value, is_main
     FROM relics ORDER BY owner_id, is_main DESC, grade DESC`,
  );

  const byOwner = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byOwner.get(r.owner_id) ?? [];
    arr.push(r);
    byOwner.set(r.owner_id, arr);
  }

  const result = new Map<string, EffectivePowerStats>();
  for (const [ownerId, ownerRelics] of byOwner) {
    const mainRelic     = ownerRelics.find(r => r.is_main);
    const storageRelics = ownerRelics.filter(r => !r.is_main);

    const mainPower = mainRelic
      ? RELIC_POWER_WEIGHTS.grade   * Number(mainRelic.grade) +
        RELIC_POWER_WEIGHTS.enhance * Number(mainRelic.enhance) +
        RELIC_POWER_WEIGHTS.effect  * Number(mainRelic.effect_value) * 100
      : 0;

    // ① storageBonus 합산: 메인 유물 100% + 보관 storage_bonus 유물 STORAGE_EFFECT_RATIO%
    let storageBonusPct = 0;
    if (mainRelic) {
      const mainTypeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === Number(mainRelic.type_id));
      if (mainTypeDef?.effectType === 'storage_bonus') {
        storageBonusPct += Number(mainRelic.effect_value);
      }
    }

    // ② 1-pass: 스택 카운트 추적 + 적격 보관 유물 수집 + storage_bonus 합산
    const stackCount: Record<string, number> = {};
    const eligiblePowers: number[] = [];

    for (const r of storageRelics) {
      const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === Number(r.type_id));
      if (!typeDef) continue;
      const key = typeDef.effectType;
      stackCount[key] = (stackCount[key] ?? 0) + 1;
      if (stackCount[key] > RELIC_CONFIG.STORAGE_STACK_MAX) continue;
      const singlePower =
        RELIC_POWER_WEIGHTS.grade   * Number(r.grade) +
        RELIC_POWER_WEIGHTS.enhance * Number(r.enhance) +
        RELIC_POWER_WEIGHTS.effect  * Number(r.effect_value) * 100;
      eligiblePowers.push(singlePower);
      if (typeDef.effectType === 'storage_bonus') {
        storageBonusPct += Number(r.effect_value) * RELIC_CONFIG.STORAGE_EFFECT_RATIO;
      }
    }

    // ③ 실효 보관 적용률 및 보관 전투력 합산
    const effectiveStorageRatio = RELIC_CONFIG.STORAGE_EFFECT_RATIO + storageBonusPct / 100;
    const storagePowerApplied   = eligiblePowers.reduce((s, p) => s + p * effectiveStorageRatio, 0);

    result.set(ownerId, {
      totalPower:          Math.round((mainPower + storagePowerApplied) * 100) / 100,
      mainPower:           Math.round(mainPower * 100) / 100,
      storagePowerApplied: Math.round(storagePowerApplied * 100) / 100,
      storageApplyRate:    Math.round(effectiveStorageRatio * 10000) / 10000,
      hasSSMain:           Number(mainRelic?.grade ?? 0) === 6,
      hasSSStorage:        storageRelics.some(r => Number(r.grade) === 6),
    });
  }

  return result;
}

// ── 유물 자산가치 조회 ────────────────────────────────────────────────────
export async function getUserRelicAssetValue(userId: string): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(relic_asset_value), 0) AS total FROM relics WHERE owner_id = $1`,
    [userId],
  );
  return Math.round(Number(rows[0]?.total ?? 0));
}

export async function getAllUserRelicAssets(): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ owner_id: string; total: string }>(
    `SELECT owner_id, COALESCE(SUM(relic_asset_value), 0) AS total
     FROM relics GROUP BY owner_id`,
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.owner_id, Math.round(Number(r.total)));
  }
  return map;
}
