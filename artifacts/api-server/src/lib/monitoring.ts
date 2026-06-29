import { pool } from '@workspace/db';

// ── 지표 모니터링 시스템 (ML v3.2 파라미터 적용 후 2주 모니터링) ──────────────
// game_events 테이블에 일별 이벤트 로그를 쌓고, 관리자 대시보드에서 조회한다.

export type EventType =
  | 'earn'             // 포인트 유입 (레거시 — 신규 코드는 세분화 타입 사용)
  | 'earn_chosung'     // 초성퀴즈 정답 보상
  | 'earn_hunmin'      // 훈민정음 단어/MVP 보상
  | 'earn_attendance'  // 출석체크 보상
  | 'earn_jamo'        // 자모연성 보상
  | 'earn_sell'        // 유물 판매 환급
  | 'enhance_try'   // 강화 시도 (비용 차감)
  | 'enhance_ok'    // 강화 성공
  | 'enhance_fail'  // 강화 실패
  | 'fuse_ok'       // 합성 성공 (비용 차감)
  | 'fuse_fail'     // 합성 실패 (비용 차감)
  | 'drop'          // 유물 드랍 (amount = grade)
  | 'gacha'         // 가챠 뽑기 (amount = 0)
  | 'expand';       // 보관함 확장 (비용 차감)

// KST 오늘 날짜 (YYYY-MM-DD)
function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// 테이블 초기화 (서버 시작 시 호출)
export async function initMonitoringTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_events (
      id         BIGSERIAL    PRIMARY KEY,
      event_type VARCHAR(20)  NOT NULL,
      user_id    VARCHAR(255),
      amount     BIGINT       NOT NULL DEFAULT 0,
      meta       VARCHAR(100) DEFAULT '',
      event_date VARCHAR(10)  NOT NULL,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_events_date ON game_events (event_date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_game_events_type_date ON game_events (event_type, event_date)`);
}

// 이벤트 기록 (fire-and-forget)
export function logEvent(
  type: EventType,
  userId: string,
  amount: number,
  meta = '',
  date = getTodayKST(),
): void {
  pool.query(
    `INSERT INTO game_events (event_type, user_id, amount, meta, event_date) VALUES ($1, $2, $3, $4, $5)`,
    [type, userId, amount, meta, date],
  ).catch((err: unknown) => {
    console.error('[monitoring] logEvent 실패:', err);
  });
}

// ── 지표 제약 범위 (ML v3.2 권고) ─────────────────────────────────────────
const CONSTRAINTS = {
  // D20 도달률: 최대 강화(20강) 유물 비율 상한 (전체 유물 대비 %)
  D20_RATE_MAX_PCT:        0.1,
  // 강화 성공률 최소 (v3.2 파라미터 적용 기대치 73%; 10건 이상 데이터 기준)
  ENHANCE_SUCCESS_MIN_PCT: 60,
  // Sink ratio 상한 (포인트 소모 / 포인트 유입)
  SINK_RATIO_MAX_PCT:      70,
  // 포인트 P99 상한 (단위: P) — 과도한 포인트 집중 경고
  P99_WARN_THRESHOLD:      5_000_000,
};

export interface EarnSourceStats {
  count: number;
  total: number;
}

export interface DailyMetrics {
  date:            string;
  enhanceTry:      number;
  enhanceOk:       number;
  enhanceFail:     number;
  enhanceSuccRateRaw: number; // % (소수 — 경고 판정에만 사용)
  enhanceSuccRate: number;    // % (소수점 1자리, 표시용)
  fuseTry:         number;    // 합성 시도 건수 (ok + fail)
  fuseOk:          number;
  fuseFail:        number;
  dropCount:       number;
  earnCount:       number;
  earnTotal:       number;    // 총 유입 포인트
  earnBySource: {             // 게임 유형별 유입 내역
    chosung:    EarnSourceStats;
    hunmin:     EarnSourceStats;
    attendance: EarnSourceStats;
    jamo:       EarnSourceStats;
    sell:       EarnSourceStats;
    legacy:     EarnSourceStats; // 구형 'earn' 이벤트
  };
  sinkTotal:       number;    // 총 소모 포인트
  sinkRatioRaw:    number;    // (경고 판정용)
  sinkRatio:       number;    // (소수점 1자리, 표시용)
  p50:             number;
  p99:             number;
  userCount:       number;
  asHolders:       number;    // A/S 등급 유물 보유자 수
  d20Count:        number;    // 20강 유물 수
  d20TotalRelics:  number;    // 전체 유물 수
  d20RateRaw:      number;    // (경고 판정용)
  d20Rate:         number;    // (소수점 2자리, 표시용)
  warnings:        string[];
}

export async function getDailyMetrics(date?: string): Promise<DailyMetrics> {
  const targetDate = date ?? getTodayKST();

  // 1. 이벤트 집계
  const { rows: evtRows } = await pool.query<{
    event_type: string;
    cnt:        string;
    total_amt:  string;
  }>(
    `SELECT event_type,
            COUNT(*)                 AS cnt,
            COALESCE(SUM(amount), 0) AS total_amt
       FROM game_events
      WHERE event_date = $1
      GROUP BY event_type`,
    [targetDate],
  );

  const evtMap: Record<string, { cnt: number; amt: number }> = {};
  for (const r of evtRows) {
    evtMap[r.event_type] = { cnt: parseInt(r.cnt), amt: parseInt(r.total_amt) };
  }

  const enhanceTry  = evtMap['enhance_try']?.cnt  ?? 0;
  const enhanceOk   = evtMap['enhance_ok']?.cnt   ?? 0;
  const enhanceFail = evtMap['enhance_fail']?.cnt  ?? 0;
  const fuseOk      = evtMap['fuse_ok']?.cnt       ?? 0;
  const fuseFail    = evtMap['fuse_fail']?.cnt      ?? 0;
  const fuseTry     = fuseOk + fuseFail;
  const dropCount   = evtMap['drop']?.cnt           ?? 0;

  // 게임 유형별 earn 집계
  const earnBySource = {
    chosung:    { count: evtMap['earn_chosung']?.cnt    ?? 0, total: evtMap['earn_chosung']?.amt    ?? 0 },
    hunmin:     { count: evtMap['earn_hunmin']?.cnt     ?? 0, total: evtMap['earn_hunmin']?.amt     ?? 0 },
    attendance: { count: evtMap['earn_attendance']?.cnt ?? 0, total: evtMap['earn_attendance']?.amt ?? 0 },
    jamo:       { count: evtMap['earn_jamo']?.cnt       ?? 0, total: evtMap['earn_jamo']?.amt       ?? 0 },
    sell:       { count: evtMap['earn_sell']?.cnt       ?? 0, total: evtMap['earn_sell']?.amt       ?? 0 },
    legacy:     { count: evtMap['earn']?.cnt            ?? 0, total: evtMap['earn']?.amt            ?? 0 },
  };

  // 전체 earn 합계 (모든 소스 포함)
  const earnCount = Object.values(earnBySource).reduce((s, v) => s + v.count, 0);
  const earnTotal = Object.values(earnBySource).reduce((s, v) => s + v.total, 0);

  const sinkTotal =
    (evtMap['enhance_try']?.amt  ?? 0) +
    (evtMap['fuse_ok']?.amt      ?? 0) +
    (evtMap['fuse_fail']?.amt    ?? 0) +
    (evtMap['expand']?.amt       ?? 0);

  // 원본(raw) 값으로 경고 판정 → 표시용만 반올림
  const enhanceSuccRateRaw = enhanceTry > 0 ? (enhanceOk / enhanceTry) * 100 : 0;
  const enhanceSuccRate    = Math.round(enhanceSuccRateRaw * 10) / 10;
  const sinkRatioRaw       = earnTotal  > 0 ? (sinkTotal / earnTotal) * 100 : 0;
  const sinkRatio          = Math.round(sinkRatioRaw * 10) / 10;

  // 2. 전체 유저 점수 분포 (P50, P99)
  const { rows: pctRows } = await pool.query<{ p50: string; p99: string; cnt: string }>(
    `SELECT PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score) AS p50,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY score) AS p99,
            COUNT(*) AS cnt
       FROM users`,
  );
  const p50       = Math.round(parseFloat(pctRows[0]?.p50 ?? '0'));
  const p99       = Math.round(parseFloat(pctRows[0]?.p99 ?? '0'));
  const userCount = parseInt(pctRows[0]?.cnt ?? '0');

  // 3. A/S 등급 유물 보유자 수
  const { rows: asRows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT owner_id) AS cnt FROM relics WHERE grade >= 4`,
  );
  const asHolders = parseInt(asRows[0]?.cnt ?? '0');

  // 4. D20 도달률 (원본 비율로 경고 판정)
  const { rows: d20Rows } = await pool.query<{ d20: string; total: string }>(
    `SELECT SUM(CASE WHEN enhance >= 20 THEN 1 ELSE 0 END) AS d20,
            COUNT(*) AS total
       FROM relics`,
  );
  const d20Count       = parseInt(d20Rows[0]?.d20   ?? '0');
  const d20TotalRelics = parseInt(d20Rows[0]?.total ?? '0');
  const d20RateRaw     = d20TotalRelics > 0 ? (d20Count / d20TotalRelics) * 100 : 0;
  const d20Rate        = Math.round(d20RateRaw * 100) / 100; // 소수점 2자리 표시

  // 5. 경고 판정 — 모두 raw 값 기준
  const warnings: string[] = [];

  if (d20RateRaw > CONSTRAINTS.D20_RATE_MAX_PCT) {
    warnings.push(`⚠️ D20 도달률 ${d20Rate}% > 제약 ${CONSTRAINTS.D20_RATE_MAX_PCT}%`);
  }
  if (enhanceTry >= 10 && enhanceSuccRateRaw < CONSTRAINTS.ENHANCE_SUCCESS_MIN_PCT) {
    warnings.push(`⚠️ 강화 성공률 ${enhanceSuccRate}% < 하한 ${CONSTRAINTS.ENHANCE_SUCCESS_MIN_PCT}%`);
  }
  if (earnTotal > 0 && sinkRatioRaw > CONSTRAINTS.SINK_RATIO_MAX_PCT) {
    warnings.push(`⚠️ Sink ratio ${sinkRatio}% > 상한 ${CONSTRAINTS.SINK_RATIO_MAX_PCT}%`);
  }
  if (p99 > CONSTRAINTS.P99_WARN_THRESHOLD) {
    warnings.push(`⚠️ P99 ${p99.toLocaleString('ko-KR')}P > 상한 ${CONSTRAINTS.P99_WARN_THRESHOLD.toLocaleString('ko-KR')}P`);
  }

  return {
    date: targetDate,
    enhanceTry, enhanceOk, enhanceFail, enhanceSuccRateRaw, enhanceSuccRate,
    fuseTry, fuseOk, fuseFail,
    dropCount, earnCount, earnTotal, earnBySource,
    sinkTotal, sinkRatioRaw, sinkRatio,
    p50, p99, userCount,
    asHolders,
    d20Count, d20TotalRelics, d20RateRaw, d20Rate,
    warnings,
  };
}

// 2주치 날짜 목록 (오늘부터 과거 방향)
export function getLast14Dates(): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 86_400_000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// 일별 상세 출력 (단일 날짜)
export function formatMetrics(m: DailyMetrics): string {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const lines = [
    `📊 2주 지표 대시보드 — ${m.date}`,
    '',
    `[강화]`,
    `시도 ${fmt(m.enhanceTry)}건  성공 ${fmt(m.enhanceOk)}  실패 ${fmt(m.enhanceFail)}  성공률 ${m.enhanceSuccRate}%`,
    '',
    `[합성]`,
    `시도 ${fmt(m.fuseTry)}건  성공 ${fmt(m.fuseOk)}  실패 ${fmt(m.fuseFail)}`,
    '',
    `[드랍]`,
    `드랍 ${fmt(m.dropCount)}건`,
    '',
    `[포인트 유입/소모]`,
    `초성퀴즈  ${fmt(m.earnBySource.chosung.count)}회 / ${fmt(m.earnBySource.chosung.total)}P`,
    `훈민정음  ${fmt(m.earnBySource.hunmin.count)}회 / ${fmt(m.earnBySource.hunmin.total)}P`,
    `출석체크  ${fmt(m.earnBySource.attendance.count)}회 / ${fmt(m.earnBySource.attendance.total)}P`,
    `자모연성  ${fmt(m.earnBySource.jamo.count)}회 / ${fmt(m.earnBySource.jamo.total)}P`,
    `유물판매  ${fmt(m.earnBySource.sell.count)}회 / ${fmt(m.earnBySource.sell.total)}P`,
    ...(m.earnBySource.legacy.count > 0 ? [`기타(레거시) ${fmt(m.earnBySource.legacy.count)}회 / ${fmt(m.earnBySource.legacy.total)}P`] : []),
    `합계      ${fmt(m.earnCount)}회 / ${fmt(m.earnTotal)}P`,
    `Sink ${fmt(m.sinkTotal)}P  →  Sink ratio ${m.sinkRatio}%`,
    '',
    `[점수 분포 (${fmt(m.userCount)}명)]`,
    `P50: ${fmt(m.p50)}P   P99: ${fmt(m.p99)}P`,
    '',
    `[유물]`,
    `A/S 보유자 ${fmt(m.asHolders)}명`,
    `20강 유물 ${fmt(m.d20Count)}개 / 전체 ${fmt(m.d20TotalRelics)}개 (${m.d20Rate}%)`,
  ];

  if (m.warnings.length > 0) {
    lines.push('');
    lines.push('[⚠️ 경고]');
    lines.push(...m.warnings);
  } else {
    lines.push('');
    lines.push('✅ 모든 지표 제약 범위 이내');
  }

  return lines.join('\n');
}

// 14일 추이 요약 (한 줄씩)
export async function format14DaySummary(): Promise<string> {
  const dates = getLast14Dates();
  // 병렬 집계
  const all = await Promise.all(dates.map(d => getDailyMetrics(d)));

  // 숫자를 짧게 표시 (1000단위 k)
  const fk = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const header = '📈 2주 지표 추이 요약\n날짜  |강화%|Sink%| P50  |초성P |훈민P |출석P |자모P';
  const sep    = '─'.repeat(56);
  const rows   = all.map(m => {
    const warn   = m.warnings.length > 0 ? '⚠️' : '✅';
    const date   = m.date.slice(5);                     // MM-DD
    const esr    = m.enhanceTry > 0 ? `${m.enhanceSuccRate}%` : '-';
    const sink   = m.earnTotal  > 0 ? `${m.sinkRatio}%` : '-';
    const p50    = m.userCount  > 0 ? fk(m.p50) : '-';
    const choP   = m.earnBySource.chosung.total    > 0 ? fk(m.earnBySource.chosung.total)    : '-';
    const hunP   = m.earnBySource.hunmin.total     > 0 ? fk(m.earnBySource.hunmin.total)     : '-';
    const attP   = m.earnBySource.attendance.total > 0 ? fk(m.earnBySource.attendance.total) : '-';
    const jamP   = m.earnBySource.jamo.total       > 0 ? fk(m.earnBySource.jamo.total)       : '-';
    return `${warn} ${date}|${esr.padStart(4)}|${sink.padStart(5)}|${p50.padStart(6)}|${choP.padStart(6)}|${hunP.padStart(6)}|${attP.padStart(6)}|${jamP.padStart(5)}`;
  });

  // 전체 경고 수집
  const allWarnings = all.flatMap(m => m.warnings);
  const warnSection = allWarnings.length > 0
    ? `\n[⚠️ 기간 내 경고]\n${allWarnings.join('\n')}`
    : '\n✅ 14일 내 제약 위반 없음';

  return [header, sep, ...rows, warnSection].join('\n');
}
