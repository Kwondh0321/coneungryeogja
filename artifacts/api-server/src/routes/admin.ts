import { Router, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { reloadQuizBankFromDb, quizBank, getRanking } from "../lib/gameState";

const router: Router = Router();

const ADMIN_TOKEN = "chosungAdminOp7x2qK9m";

router.post("/admin/boost-scores", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const amount = Number(req.body?.amount ?? 5000);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return res.status(400).json({ error: "invalid amount" });
  }

  const result = await pool.query<{ user_id: string; nickname: string; score: string }>(
    `UPDATE users SET score = score + $1 RETURNING user_id, nickname, score`,
    [amount]
  );

  return res.json({ updated: result.rowCount, rows: result.rows });
});

router.post("/admin/score-x10", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const check = await pool.query<{ avg_score: string }>(
    `SELECT AVG(score)::bigint AS avg_score FROM users`
  );
  const avgScore = Number(check.rows[0]?.avg_score ?? 0);

  if (avgScore > 50000) {
    return res.status(409).json({
      error: "already_multiplied",
      message: `현재 평균 포인트가 ${avgScore.toLocaleString()}P입니다. 이미 배율이 적용된 것으로 보입니다. 강제 실행하려면 force=true를 전달하세요.`,
      avg_score: avgScore,
    });
  }

  if (req.body?.force !== true && avgScore > 50000) {
    return res.status(409).json({ error: "already_multiplied", avg_score: avgScore });
  }

  const result = await pool.query<{ count: string }>(
    `UPDATE users
     SET score              = score * 10,
         total_earned_point = total_earned_point * 10,
         total_spent_point  = total_spent_point  * 10
     WHERE true`
  );

  const after = await pool.query<{ avg_score: string; total_score: string }>(
    `SELECT AVG(score)::bigint AS avg_score, SUM(score) AS total_score FROM users`
  );

  return res.json({
    ok: true,
    updated_rows: result.rowCount,
    before_avg: avgScore,
    after_avg: Number(after.rows[0]?.avg_score ?? 0),
    after_total: Number(after.rows[0]?.total_score ?? 0),
  });
});

// POST /api/admin/give-s-relics  { userId: "..." }
// 해당 유저에게 모든 종류(8종) S등급 20강 유물을 지급
router.post("/admin/give-s-relics", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // 유저 존재 확인
  const userCheck = await pool.query(`SELECT user_id FROM users WHERE user_id = $1`, [userId]);
  if (userCheck.rowCount === 0) {
    return res.status(404).json({ error: "유저를 찾을 수 없어요" });
  }

  // 8종 유물 타입 (D→S 순서에서 S=grade 5)
  // S등급 effect_value = 27.50 + 20강 × 0.03 = 28.10
  const TYPE_IDS = [1, 2, 3, 4, 7, 8, 9, 10];
  const GRADE    = 5;
  const LEVEL    = 1;
  const ENHANCE  = 20;
  const EFFECT   = 28.10;

  // 기존 메인 유물이 없으면 첫 번째 유물을 메인으로 설정
  const existingMain = await pool.query(
    `SELECT relic_id FROM relics WHERE owner_id = $1 AND is_main = TRUE`,
    [userId]
  );
  const hasMain = (existingMain.rowCount ?? 0) > 0;

  const inserted: number[] = [];
  for (let i = 0; i < TYPE_IDS.length; i++) {
    const typeId = TYPE_IDS[i];
    const isMain = !hasMain && i === 0;
    const { rows } = await pool.query<{ relic_id: number }>(
      `INSERT INTO relics (owner_id, type_id, grade, level, enhance, exp, is_main, effect_value)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
       RETURNING relic_id`,
      [userId, typeId, GRADE, LEVEL, ENHANCE, isMain, EFFECT]
    );
    inserted.push(rows[0]!.relic_id);
  }

  return res.json({
    ok: true,
    userId,
    givenRelics: TYPE_IDS.map((typeId, i) => ({
      relicId: inserted[i],
      typeId,
      grade: "S",
      enhance: ENHANCE,
      effectValue: EFFECT,
      isMain: !hasMain && i === 0,
    })),
  });
});

// POST /api/admin/recalc-relics
// 모든 유물 effect_value를 현재 BASE_EFFECT 기준으로 일괄 재계산
router.post("/admin/recalc-relics", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const result = await pool.query<{ relic_id: number; grade: number; level: number; enhance: number; effect_value: number }>(
    `UPDATE relics
     SET effect_value = ROUND((
       CASE grade
         WHEN 1 THEN 6.93
         WHEN 2 THEN 10.56
         WHEN 3 THEN 17.67
         WHEN 4 THEN 30.42
         WHEN 5 THEN 48.45
       END
       * (1.0 + (level - 1) * 0.01)
       * (1.0 + enhance * 0.03)
     )::numeric, 1)
     RETURNING relic_id, grade, level, enhance, effect_value`
  );

  return res.json({
    ok: true,
    updated: result.rowCount,
    rows: result.rows,
  });
});

// POST /api/admin/delete-blocked-words
// 부적절 단어를 dict_words에서 삭제 (프로덕션 포함)
router.post("/admin/delete-blocked-words", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const BLOCKED: string[] = [
    '범성애',
    '성관계',
    '성기','성기가','성기를','성기에',
    '대마초','마리화나','코카인','헤로인',
    '낙태','낙태죄','낙태하다',
    '미친년','미친놈',
    '새끼','사내새끼','애새끼','자식새끼','쥐새끼',
    '놈팡이',
    '장애자',
    '자살','자살극','자살로','자살은','자살을','자살이','자살자',
    '자살하게','자살하고','자살하다','자살한','자살할','투신자살',
    '자해','자해하다',
    '살인마','살인강도',
  ];

  const result = await pool.query<{ word: string }>(
    `DELETE FROM dict_words WHERE word = ANY($1::text[]) RETURNING word`,
    [BLOCKED]
  );

  return res.json({ ok: true, deleted: result.rowCount, words: result.rows.map(r => r.word) });
});

// POST /api/admin/reload-quiz
// DB에서 퀴즈 문제를 즉시 다시 읽어 메모리에 반영 (재시작 없이 적용)
router.post("/admin/reload-quiz", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const count = await reloadQuizBankFromDb();
  return res.json({ ok: true, loaded: count });
});

// GET /api/admin/quiz-stats
// 현재 메모리에 로드된 퀴즈 수 및 카테고리별 현황 확인
router.get("/admin/quiz-stats", async (req: Request, res: Response) => {
  const auth = req.headers["x-admin-token"];
  if (auth !== ADMIN_TOKEN) {
    return res.status(403).json({ error: "forbidden" });
  }

  const byCategory: Record<string, number> = {};
  for (const q of quizBank) {
    byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
  }

  const { rows } = await pool.query<{ c: string }>('SELECT COUNT(*) AS c FROM quizzes');
  const dbCount = parseInt(rows[0].c, 10);

  return res.json({
    memory: quizBank.length,
    db: dbCount,
    inSync: quizBank.length === dbCount,
    byCategory,
  });
});

// ── 방문 기록 (인증 불필요) ─────────────────────────────────
router.post("/stats/visit", async (_req: Request, res: Response) => {
  await pool.query('INSERT INTO site_visits (visited_at) VALUES (NOW())').catch(() => {});
  return res.json({ ok: true });
});

// ── 공개 통계 (인증 불필요) ─────────────────────────────────
router.get("/stats/public", async (_req: Request, res: Response) => {
  const ranking = getRanking();
  const userCount    = ranking.length;
  const totalScore   = ranking.reduce((s, u) => s + u.score, 0);
  const totalAnswers = ranking.reduce((s, u) => s + u.total, 0);
  const totalCorrect = ranking.reduce((s, u) => s + u.correct, 0);
  const quizCount    = quizBank.length;

  const todayStart = `date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'`;

  let totalVisits = 0;
  let todayVisits = 0;
  let todayActiveUsers = 0;

  const [visitResult, activeResult] = await Promise.allSettled([
    pool.query<{ total: string; today: string }>(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE visited_at >= ${todayStart}) AS today
      FROM site_visits
    `),
    pool.query<{ c: string }>(`
      SELECT COUNT(DISTINCT user_id) AS c
      FROM kakao_daily_active
      WHERE activity_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
    `),
  ]);

  if (visitResult.status === 'fulfilled') {
    totalVisits = parseInt(visitResult.value.rows[0]?.total ?? '0', 10);
    todayVisits = parseInt(visitResult.value.rows[0]?.today ?? '0', 10);
  }
  if (activeResult.status === 'fulfilled') {
    todayActiveUsers = parseInt(activeResult.value.rows[0]?.c ?? '0', 10);
  }

  return res.json({ userCount, quizCount, totalAnswers, totalCorrect, totalScore, totalVisits, todayVisits, todayActiveUsers });
});

export default router;
