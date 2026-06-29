import { pool } from "@workspace/db";
import { calculateEffectiveBattlePower } from "./newRelicSystem";

export const BATTLE_CONFIG = {
  daily_limit:      30,
  win_reward_mult:  7,       // 승리 보상 배율: 상대 전투력 × 7 (0.7배 하향)
  win_reward_cap:   3_000_000, // 승리 보상 최대치 (300만P)
  // 상대적 temperature: 고정값 대신 두 전투력의 평균 × 이 비율로 나눔
  // → 전투력 규모가 아무리 커져도 "차이 비율"로 승률 결정
  // 0.5 기준: 62% 전력차(338K vs 548K) → 약 28%, 1% 차이(1M vs 1.01M) → 약 49.5%
  relative_temp:    0.5,
  grade_weight:     1.0162,
  enhance_weight:   0.03,
  effect_weight:    0.8704,
  MIN_WIN_RATE:     0.05,    // 최저 승률 (클램프)
  MAX_WIN_RATE:     0.95,    // 최고 승률 (클램프)
} as const;

export function calcBattlePower(
  grade: number,
  enhance: number,
  effectValue: number,
): number {
  return (
    BATTLE_CONFIG.grade_weight   * grade +
    BATTLE_CONFIG.enhance_weight * enhance +
    BATTLE_CONFIG.effect_weight  * effectValue * 100
  );
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function calcWinProbability(
  myPower: number,
  oppPower: number,
  minWinRate: number = BATTLE_CONFIG.MIN_WIN_RATE,
): number {
  const avgPower = (myPower + oppPower) / 2;
  const scale    = avgPower * BATTLE_CONFIG.relative_temp;
  const raw      = sigmoid((myPower - oppPower) / (scale || 1));
  return clamp(raw, minWinRate, BATTLE_CONFIG.MAX_WIN_RATE);
}

export async function getDailyBattleCount(
  attackerId: string,
  date: string,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT count FROM battle_log WHERE attacker_id = $1 AND battle_date = $2`,
    [attackerId, date],
  );
  return rows.length > 0 ? Number(rows[0].count) : 0;
}

export async function incrementBattleCount(
  attackerId: string,
  date: string,
): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO battle_log (attacker_id, battle_date, count, won, lost)
     VALUES ($1, $2, 1, 0, 0)
     ON CONFLICT (attacker_id, battle_date)
     DO UPDATE SET count = battle_log.count + 1
     WHERE battle_log.count < $3`,
    [attackerId, date, BATTLE_CONFIG.daily_limit],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateBattleOutcome(
  attackerId: string,
  date: string,
  won: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE battle_log
     SET won  = won  + $3,
         lost = lost + $4
     WHERE attacker_id = $1 AND battle_date = $2`,
    [attackerId, date, won ? 1 : 0, won ? 0 : 1],
  );
}

export async function recordBattleResult(
  attackerId:   string,
  defenderId:   string,
  defenderNick: string,
  date:         string,
  won:          boolean,
  winReward:    number,
): Promise<void> {
  await pool.query(
    `INSERT INTO battle_result_log (attacker_id, defender_id, defender_nick, battle_date, won, steal_net)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [attackerId, defenderId, defenderNick, date, won, winReward],
  );
}

export async function getUserBattleStats(userId: string): Promise<{
  total: number; wins: number; losses: number; winRate: number;
}> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(CASE
              WHEN (attacker_id = $1 AND won = true)
                OR (defender_id = $1 AND won = false)
              THEN 1 END) AS wins,
            COUNT(CASE
              WHEN (attacker_id = $1 AND won = false)
                OR (defender_id = $1 AND won = true)
              THEN 1 END) AS losses
     FROM battle_result_log
     WHERE attacker_id = $1 OR defender_id = $1`,
    [userId],
  );
  const total   = Number(rows[0]?.total  ?? 0);
  const wins    = Number(rows[0]?.wins   ?? 0);
  const losses  = Number(rows[0]?.losses ?? 0);
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { total, wins, losses, winRate };
}

export async function getRecentBattles(
  userId: string,
  limit = 20,
): Promise<Array<{
  id: number; opponentNick: string; battleDate: string; battleTs: string;
  iWon: boolean; stealNet: number; isAttacker: boolean;
}>> {
  const { rows } = await pool.query(
    `SELECT id, opponent_nick, battle_date, battle_ts, i_won, steal_net, is_attacker
     FROM (
       SELECT id, defender_nick AS opponent_nick, battle_date, battle_ts,
              won               AS i_won,
              steal_net,
              true              AS is_attacker
       FROM battle_result_log WHERE attacker_id = $1
       UNION ALL
       SELECT b.id,
              COALESCE(u.nickname, '알 수 없음') AS opponent_nick,
              b.battle_date, b.battle_ts,
              NOT b.won       AS i_won,
              0               AS steal_net,
              false           AS is_attacker
       FROM battle_result_log b
       LEFT JOIN users u ON u.user_id = b.attacker_id
       WHERE b.defender_id = $1
     ) t
     ORDER BY battle_ts DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map(r => ({
    id:           Number(r.id),
    opponentNick: String(r.opponent_nick),
    battleDate:   String(r.battle_date),
    battleTs:     String(r.battle_ts),
    iWon:         Boolean(r.i_won),
    stealNet:     Number(r.steal_net),
    isAttacker:   Boolean(r.is_attacker),
  }));
}

export interface BattleResult {
  won:                    boolean;
  winProb:                number;
  winReward:              number;
  myPower:                number;
  oppPower:               number;
  mainPower:              number;
  oppMainPower:           number;
  storagePowerApplied:    number;
  oppStoragePowerApplied: number;
}

export async function conductBattle(
  attackerId: string,
  defenderId: string,
): Promise<BattleResult> {
  const [attStats, defStats] = await Promise.all([
    calculateEffectiveBattlePower(attackerId),
    calculateEffectiveBattlePower(defenderId),
  ]);

  const myPower  = attStats.totalPower;
  const oppPower = defStats.totalPower;

  // 상대가 SS 유물을 보유한 경우 도전자의 최소 승률을 하향
  // 메인+보관 모두: 1%, 메인만: 2%, 보관만: 3%, 없음: 5%(기본)
  const oppMinWin =
    defStats.hasSSMain && defStats.hasSSStorage ? 0.01 :
    defStats.hasSSMain                          ? 0.02 :
    defStats.hasSSStorage                       ? 0.03 :
    BATTLE_CONFIG.MIN_WIN_RATE;

  const winProb   = calcWinProbability(myPower, oppPower, oppMinWin);
  const won       = Math.random() < winProb;
  // 보상은 상대방 실효 전투력 기준
  const winReward = won ? Math.min(BATTLE_CONFIG.win_reward_cap, Math.round(oppPower * BATTLE_CONFIG.win_reward_mult)) : 0;

  return {
    won,
    winProb,
    winReward,
    myPower,
    oppPower,
    mainPower:              attStats.mainPower,
    oppMainPower:           defStats.mainPower,
    storagePowerApplied:    attStats.storagePowerApplied,
    oppStoragePowerApplied: defStats.storagePowerApplied,
  };
}
