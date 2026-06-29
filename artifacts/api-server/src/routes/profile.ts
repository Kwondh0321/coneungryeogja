import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { getRanking, getUserScore, hasAttendedToday, type UserScore } from "../lib/gameState";
import {
  getUserInventory,
  getRelicEffects,
  getRelicName,
  getNewRelicImageUrl,
  RELIC_TYPE_CATALOG,
  GRADE_NAMES,
  GRADE_STARS,
  type RelicRow,
} from "../lib/newRelicSystem";
import { getUserBattleStats, getRecentBattles } from "../lib/battleSystem";
import { computeAllTitles, getTopTitle, type TitleDef, type TitleInput } from "../lib/titles";
import { logger } from "../lib/logger";

const router = Router();

interface UserData extends UserScore {
  jamoBestStreak:  number;
  jamoTotalCount:  number;
  jamoEasyCount:   number;
  jamoNormalCount: number;
  jamoHardCount:   number;
  lastJamoAt:      string;
}

function enrichRelic(r: RelicRow) {
  const typeDef = RELIC_TYPE_CATALOG.find(t => t.typeId === r.typeId);
  return {
    relicId:     r.relicId,
    typeId:      r.typeId,
    typeName:    typeDef?.typeName ?? "알 수 없음",
    effectType:  typeDef?.effectType ?? "",
    gradeNum:    r.grade,
    gradeName:   GRADE_NAMES[r.grade],
    gradeStars:  GRADE_STARS[r.grade],
    name:        getRelicName(r.typeId, r.grade),
    level:       r.level,
    enhance:     r.enhance,
    effectValue: r.effectValue,
    imageUrl:    getNewRelicImageUrl(r.typeId, r.grade),
    isMain:      r.isMain,
    createdAt:   r.createdAt,
  };
}

router.get("/:userId", async (req: Request, res: Response) => {
  const uid = String(req.params["userId"] ?? "");

  try {
    let user: UserData | null = null;

    const cached = getUserScore(uid);
    if (cached) {
      user = {
        ...cached,
        jamoBestStreak:  (cached as UserData).jamoBestStreak  ?? 0,
        jamoTotalCount:  (cached as UserData).jamoTotalCount  ?? 0,
        jamoEasyCount:   (cached as UserData).jamoEasyCount   ?? 0,
        jamoNormalCount: (cached as UserData).jamoNormalCount ?? 0,
        jamoHardCount:   (cached as UserData).jamoHardCount   ?? 0,
        lastJamoAt:      (cached as UserData).lastJamoAt      ?? '',
      };
    } else {
      const { rows } = await pool.query<{
        nickname: string; score: string; correct: string; total: string;
        hunmin_wins: number; hunmin_max: number; hunmin_total: number;
        relic_inv_limit: number; jamo_streak: number; last_jamo_date: string;
        jamo_best_streak: number; jamo_total_count: number;
        jamo_easy_count: number; jamo_normal_count: number; jamo_hard_count: number; last_jamo_at: string;
      }>(
        `SELECT nickname, score, correct, total, hunmin_wins, hunmin_max, hunmin_total,
                relic_inv_limit, jamo_streak, last_jamo_date,
                COALESCE(jamo_best_streak,    0) AS jamo_best_streak,
                COALESCE(jamo_total_count,    0) AS jamo_total_count,
                COALESCE(jamo_easy_count,     0) AS jamo_easy_count,
                COALESCE(jamo_normal_count,   0) AS jamo_normal_count,
                COALESCE(jamo_hard_count,     0) AS jamo_hard_count,
                COALESCE(last_jamo_at,       '') AS last_jamo_at
         FROM users WHERE user_id = $1`,
        [uid]
      );
      if (!rows[0]) return res.status(404).json({ error: "유저를 찾을 수 없어요" });
      const r = rows[0];
      user = {
        userId:        uid,
        nickname:      r.nickname,
        score:         Number(r.score),
        correct:       Number(r.correct),
        total:         Number(r.total),
        hunminWins:    r.hunmin_wins,
        hunminMax:     r.hunmin_max,
        hunminTotal:   r.hunmin_total,
        relicInvLimit: r.relic_inv_limit,
        jamoStreak:     r.jamo_streak,
        lastJamoDate:   r.last_jamo_date,
        jamoBestStreak: r.jamo_best_streak,
        jamoTotalCount: r.jamo_total_count,
        jamoEasyCount:  r.jamo_easy_count,
        jamoNormalCount:r.jamo_normal_count,
        jamoHardCount:  r.jamo_hard_count,
        lastJamoAt:     r.last_jamo_at,
      };
    }

    const ranking    = getRanking();
    const rankIdx    = ranking.findIndex(u => u.userId === uid);
    const rank       = rankIdx >= 0 ? rankIdx + 1 : 0;
    const totalUsers = ranking.length;
    const topPct     = rank > 0 && totalUsers > 0
      ? Math.ceil((rank / totalUsers) * 100)
      : 0;

    const [inventory, effects, attRows, battleStats, recentBattles, nickHistRows] = await Promise.all([
      getUserInventory(uid, user.relicInvLimit ?? 8),
      getRelicEffects(uid),
      pool.query<{ date: string }>(
        `SELECT date FROM attendance_history WHERE user_id = $1 ORDER BY date DESC`,
        [uid]
      ),
      getUserBattleStats(uid),
      getRecentBattles(uid, 100000),
      pool.query<{ id: number; old_nickname: string; new_nickname: string; changed_at: string }>(
        `SELECT id, old_nickname, new_nickname, changed_at
         FROM nickname_change_log WHERE user_id = $1 ORDER BY changed_at DESC`,
        [uid]
      ),
    ]);

    const attendanceHistory = attRows.rows.map(r => r.date);

    const ownedTypeIds = new Set([
      ...(inventory.mainRelic ? [inventory.mainRelic.typeId] : []),
      ...inventory.storageRelics.map(r => r.typeId),
    ]);

    const allRelics = [
      ...(inventory.mainRelic ? [inventory.mainRelic] : []),
      ...inventory.storageRelics,
    ];
    const titleInput: TitleInput = {
      correct:         user.correct,
      total:           user.total,
      hunminWins:      user.hunminWins    ?? 0,
      hunminMax:       user.hunminMax     ?? 0,
      hunminTotal:     user.hunminTotal   ?? 0,
      jamoTotalCount:  user.jamoTotalCount  ?? 0,
      jamoBestStreak:  user.jamoBestStreak  ?? 0,
      jamoHardCount:   user.jamoHardCount   ?? 0,
      jamoNormalCount: user.jamoNormalCount ?? 0,
      jamoEasyCount:   user.jamoEasyCount   ?? 0,
      currentScore:    user.score,
      attendanceDays:  attendanceHistory.length,
      relics:          allRelics.map(r => ({ grade: r.grade, enhance: r.enhance, level: r.level, typeId: r.typeId })),
    };
    const allTitles = computeAllTitles(titleInput);

    // ── 업적 영구 보존: DB 기록 조회 + 신규 획득분 저장 ──────────────
    const dbRes = await pool.query<{ title_id: string }>(
      "SELECT title_id FROM earned_titles WHERE user_id = $1",
      [uid]
    );
    const dbEarned = new Set(dbRes.rows.map(r => r.title_id));

    // 현재 조건 충족이지만 DB에 없는 것 → INSERT
    const newlyEarned = allTitles.filter(t => t.earned && !dbEarned.has(t.id));
    if (newlyEarned.length > 0) {
      const placeholders = newlyEarned.map((_, i) => `($1, $${i + 2})`).join(", ");
      await pool.query(
        `INSERT INTO earned_titles (user_id, title_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        [uid, ...newlyEarned.map(t => t.id)]
      );
      newlyEarned.forEach(t => dbEarned.add(t.id));
    }

    // DB 기록 OR 현재 조건 충족 → earned = true (영구 보존)
    const mergedTitles = allTitles.map(t => ({ ...t, earned: t.earned || dbEarned.has(t.id) }));
    const topTitle = mergedTitles
      .filter(t => t.earned)
      .sort((a, b) => b.score - a.score)[0] ?? null;

    return res.json({
      user: {
        userId:         uid,
        nickname:       user.nickname,
        score:          user.score,
        rank,
        totalUsers,
        topPct,
        correct:        user.correct,
        total:          user.total,
        accuracy:       user.total > 0 ? Math.round(user.correct / user.total * 100) : 0,
        hunminWins:     user.hunminWins   ?? 0,
        hunminMax:      user.hunminMax    ?? 0,
        hunminTotal:    user.hunminTotal  ?? 0,
        jamoStreak:      user.jamoStreak      ?? 0,
        jamoBestStreak:  user.jamoBestStreak  ?? 0,
        lastJamoDate:    user.lastJamoDate    ?? '',
        jamoTotalCount:  user.jamoTotalCount  ?? 0,
        jamoEasyCount:   user.jamoEasyCount   ?? 0,
        jamoNormalCount: user.jamoNormalCount ?? 0,
        jamoHardCount:   user.jamoHardCount   ?? 0,
        lastJamoAt:      user.lastJamoAt      ?? '',
        attendedToday:  hasAttendedToday(uid),
      },
      relics: {
        mainRelic:     inventory.mainRelic ? enrichRelic(inventory.mainRelic) : null,
        storageRelics: inventory.storageRelics.map(enrichRelic),
        capacity:      inventory.capacity,
        effects,
      },
      relicCatalog: RELIC_TYPE_CATALOG.map(t => ({
        typeId:      t.typeId,
        typeName:    t.typeName,
        description: t.description,
        effectType:  t.effectType,
        owned:       ownedTypeIds.has(t.typeId),
        ownedRelics: [
          ...(inventory.mainRelic && inventory.mainRelic.typeId === t.typeId
            ? [enrichRelic(inventory.mainRelic)] : []),
          ...inventory.storageRelics.filter(r => r.typeId === t.typeId).map(enrichRelic),
        ],
      })),
      attendanceHistory,
      battleStats,
      recentBattles,
      nicknameHistory: nickHistRows.rows.map(r => ({
        id: r.id,
        oldNickname: r.old_nickname,
        newNickname: r.new_nickname,
        changedAt: r.changed_at,
      })),
      titles: {
        all: mergedTitles,
        top: topTitle,
      },
    });
  } catch (err) {
    logger.error({ err }, "Profile API error");
    return res.status(500).json({ error: "서버 오류가 발생했어요" });
  }
});

export default router;
