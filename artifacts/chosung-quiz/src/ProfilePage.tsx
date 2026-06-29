import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import heroImage from "/chosung-hero3.png";
import { useOgMeta } from "./hooks/use-og-meta";
import PatchNoticeModal from "./components/PatchNoticeModal";

const API = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

function rankingUrl(page = 1) {
  const isProd = window.location.hostname.endsWith("chosung.app");
  return isProd
    ? `https://rank.chosung.app?page=${page}`
    : `/ranking?page=${page}`;
}

// ── 타입 ──────────────────────────────────────────────────────────────────
interface EnrichedRelic {
  relicId: number; typeId: number; typeName: string; effectType: string;
  gradeNum: number; gradeName: string; gradeStars: string; name: string;
  level: number; enhance: number; effectValue: number;
  imageUrl: string; isMain: boolean; createdAt: string;
}

// 강화 효과값 계산 (서버와 동일 공식)
const BASE_EFFECT = [2.37, 4.73, 9.36, 17.64, 29.36, 95.0];
function calcEffect(grade: number, level: number, enhance: number) {
  const base = BASE_EFFECT[grade - 1];
  return Math.round(base * (1 + (level - 1) * 0.01) * (1 + enhance * 0.03) * 10) / 10;
}
interface RelicEffects {
  allBonus: number; chosungBonus: number; hunminBonus: number; jamoBonus: number;
  comboBonus: number; enhanceCostReduce: number; expBonus: number; storageBonus: number;
}
interface CatalogEntry {
  typeId: number; typeName: string; description: string; effectType: string;
  owned: boolean; ownedRelics: EnrichedRelic[];
}
interface BattleStats {
  total: number; wins: number; losses: number; winRate: number;
}
interface RecentBattle {
  id: number; opponentNick: string; battleDate: string; battleTs: string;
  iWon: boolean; stealNet: number; isAttacker: boolean;
}
interface TitleDef {
  id: string;
  name: string;
  category: "초성퀴즈" | "훈민정음" | "자모연성" | "유물" | "포인트";
  description: string;
  score: number;
  icon: string;
  earned: boolean;
}
interface NicknameHistoryEntry {
  id: number;
  oldNickname: string;
  newNickname: string;
  changedAt: string;
}
interface ProfileData {
  user: {
    userId: string; nickname: string; score: number;
    rank: number; totalUsers: number; topPct: number;
    correct: number; total: number; accuracy: number;
    hunminWins: number; hunminMax: number; hunminTotal: number;
    jamoStreak: number; jamoBestStreak: number; lastJamoDate: string;
    jamoTotalCount: number; jamoEasyCount: number; jamoNormalCount: number; jamoHardCount: number; lastJamoAt: string;
    attendedToday: boolean;
  };
  relics: {
    mainRelic: EnrichedRelic | null;
    storageRelics: EnrichedRelic[];
    capacity: number;
    effects: RelicEffects;
  };
  relicCatalog: CatalogEntry[];
  attendanceHistory: string[];
  battleStats: BattleStats;
  recentBattles: RecentBattle[];
  nicknameHistory: NicknameHistoryEntry[];
  titles: {
    all: TitleDef[];
    top: TitleDef | null;
  };
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString("ko-KR"); }

const GRADE_COLORS: Record<number, string> = {
  1: "#9ca3af",
  2: "#22c55e",
  3: "#3b82f6",
  4: "#0EA5E9",
  5: "#eab308",
  6: "#e11d48",
};
const GRADE_BG: Record<number, string> = {
  1: "rgba(156,163,175,0.15)",
  2: "rgba(34,197,94,0.15)",
  3: "rgba(59,130,246,0.15)",
  4: "rgba(3,105,161,0.15)",
  5: "rgba(234,179,8,0.15)",
  6: "rgba(225,29,72,0.15)",
};

function getRankEmoji(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  if (rank <= 10) return "🏆";
  if (rank <= 50) return "⭐";
  if (rank <= 100) return "✨";
  return "🔮";
}

function getScoreTitle(topPct: number) {
  if (topPct <= 1)  return "전설의 초능력자";
  if (topPct <= 10) return "마스터 능력자";
  if (topPct <= 30) return "고수 능력자";
  if (topPct <= 50) return "중급 능력자";
  if (topPct <= 70) return "신진 능력자";
  return "초보 능력자";
}

function getEffectLabel(effectType: string, val: number): string {
  const map: Record<string, string> = {
    all_bonus:           `모든 게임 포인트 +${val}%`,
    chosung_bonus:       `초성퀴즈 포인트 +${val}%`,
    hunmin_bonus:        `훈민정음 포인트 +${val}%`,
    jamo_bonus:          `자모연성 포인트 +${val}%`,
    combo_bonus:         `콤보 보너스 +${val}%`,
    enhance_cost_reduce: `강화 비용 감소 ${val}%`,
    exp_bonus:           `경험치 획득 +${val}%`,
    storage_bonus:       `보관함 효과 +${val}%`,
  };
  return map[effectType] ?? `+${val}%`;
}

// effectType 문자열을 RelicEffects 키로 변환해 합산값 반환 (메인+보관함 포함)
function getCombinedEffectVal(effectType: string, eff: RelicEffects): number {
  const map: Record<string, keyof RelicEffects> = {
    all_bonus:           'allBonus',
    chosung_bonus:       'chosungBonus',
    hunmin_bonus:        'hunminBonus',
    jamo_bonus:          'jamoBonus',
    combo_bonus:         'comboBonus',
    enhance_cost_reduce: 'enhanceCostReduce',
    exp_bonus:           'expBonus',
    storage_bonus:       'storageBonus',
  };
  const key = map[effectType];
  return key ? eff[key] : 0;
}

// 화면 너비 반응형 훅
function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// ── 단일 월 달력 렌더러 ────────────────────────────────────────────────────
function MonthGrid({ year, month, attended, today }: {
  year: number; month: number; attended: Set<string>; today: Date;
}) {
  function pad(n: number) { return String(n).padStart(2, "0"); }
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const monthStr = `${year}-${pad(month + 1)}`;
  const totalAttended = Array.from(attended).filter(d => d.startsWith(monthStr)).length;

  return (
    <div style={styles.calWrap}>
      <div style={{ ...styles.calHeader, justifyContent: "center", gap: 12 }}>
        <span style={styles.calTitle}>
          {year}년 {month + 1}월
          {totalAttended > 0 && <span style={styles.calCount}>{totalAttended}일</span>}
        </span>
      </div>
      <div style={styles.calGrid}>
        {["일","월","화","수","목","금","토"].map(d => (
          <div key={d} style={styles.calDow}>{d}</div>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return <div key={`${wi}-${di}`} />;
            const ds = `${monthStr}-${pad(day)}`;
            const ok = attended.has(ds);
            const tod = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <div key={ds} style={{
                ...styles.calCell,
                background: ok ? "rgba(3,105,161,0.25)" : tod ? "rgba(255,255,255,0.06)" : "transparent",
                border: tod ? "1.5px solid rgba(3,105,161,0.6)" : "1.5px solid transparent",
              }}>
                <span style={{ ...styles.calDay, color: ok ? "#38BDF8" : tod ? "#e2e8f0" : "#64748b" }}>
                  {day}
                </span>
                {ok && <span style={styles.calDot}>✓</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── 달력 (반응형: 모바일 1개월, 태블릿↑ 2개월) ───────────────────────────
function AttendanceCalendar({ history }: { history: string[] }) {
  const attended = new Set(history);
  const today = new Date();
  const windowWidth = useWindowWidth();
  const showTwo = windowWidth >= 641;

  const count = showTwo ? 2 : 1;
  // offset: 이전으로 몇 달 이동했는지
  const [offset, setOffset] = useState(0);

  const months: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i - offset, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const canGoForward = offset > 0;

  return (
    <div>
      <div style={styles.calNavRow}>
        <button style={styles.calNav} onClick={() => setOffset(o => o + count)}>‹ 이전</button>
        <button
          style={{ ...styles.calNav, opacity: canGoForward ? 1 : 0.3 }}
          disabled={!canGoForward}
          onClick={() => setOffset(o => Math.max(0, o - count))}
        >다음 ›</button>
      </div>
      <div style={{ ...styles.calMonthsRow, gridTemplateColumns: showTwo ? "repeat(2, 1fr)" : "1fr" }}>
        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`} style={styles.calMonthCol}>
            <MonthGrid year={year} month={month} attended={attended} today={today} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 유물 카드 ─────────────────────────────────────────────────────────────
function RelicCard({ relic, badge, onClick }: { relic: EnrichedRelic; badge?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.relicCard,
        border: `1.5px solid ${GRADE_COLORS[relic.gradeNum]}44`,
        background: GRADE_BG[relic.gradeNum],
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...(onClick ? { boxShadow: "0 0 0 0 transparent" } : {}),
      }}
      onMouseEnter={onClick ? e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${GRADE_COLORS[relic.gradeNum]}99`; } : undefined}
      onMouseLeave={onClick ? e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${GRADE_COLORS[relic.gradeNum]}44`; } : undefined}
    >
      {badge && <div style={{ ...styles.relicBadge, background: GRADE_COLORS[relic.gradeNum] }}>{badge}</div>}
      <div style={styles.relicImgWrap}>
        <img src={relic.imageUrl} alt={relic.name} style={styles.relicImg} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
      <div style={styles.relicInfo}>
        <div style={{ ...styles.relicGrade, color: GRADE_COLORS[relic.gradeNum] }}>
          {relic.gradeStars} {relic.gradeName}등급
        </div>
        <div style={styles.relicName}>{relic.name}</div>
        <div style={styles.relicType}>{relic.typeName}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
          {getEffectLabel(relic.effectType, relic.effectValue)}
        </div>
        <div style={styles.relicStats}>
          <span style={styles.relicStat}>Lv.{relic.level}</span>
          <span style={styles.relicStat}>{relic.enhance}강</span>
          <span style={{ ...styles.relicStat, color: "#0EA5E9" }}>+{calcEffect(relic.gradeNum, relic.level, relic.enhance)}%</span>
        </div>
      </div>
    </div>
  );
}

// ── 도감 상세 모달 ───────────────────────────────────────────────────────
const GRADE_LABEL: Record<number, string> = { 1: "D", 2: "C", 3: "B", 4: "A", 5: "S", 6: "SS" };

function CatalogDetailModal({ entry, onClose }: { entry: CatalogEntry; onClose: () => void }) {
  const [expandedGrade, setExpandedGrade] = useState<number | null>(() => {
    const owned = entry.ownedRelics.map(r => r.gradeNum);
    return owned.length > 0 ? Math.max(...owned) : null;
  });

  // gradeNum → 보유 유물 매핑
  const gradeMap = new Map<number, EnrichedRelic>();
  entry.ownedRelics.forEach(r => {
    const existing = gradeMap.get(r.gradeNum);
    if (!existing || r.effectValue > existing.effectValue) gradeMap.set(r.gradeNum, r);
  });

  const expandedRelic = expandedGrade !== null ? gradeMap.get(expandedGrade) ?? null : null;

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.box} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <div style={modalStyles.title}>{entry.typeName}</div>
            <div style={modalStyles.desc}>{entry.description}</div>
          </div>
          <button style={modalStyles.close} onClick={onClose}>✕</button>
        </div>

        {/* D ~ SS 등급 6칸 */}
        <div style={modalStyles.gradeRow}>
          {[1, 2, 3, 4, 5, 6].map(gNum => {
            const relic = gradeMap.get(gNum);
            const owned = !!relic;
            const color = GRADE_COLORS[gNum];
            const isExpanded = expandedGrade === gNum;
            const hasEnhanced = owned && relic!.enhance > 0;
            return (
              <div
                key={gNum}
                style={{
                  ...modalStyles.gradeCell,
                  opacity: owned ? 1 : 0.3,
                  cursor: owned ? "pointer" : "default",
                  border: isExpanded ? `1.5px solid ${color}` : `1.5px solid ${owned ? color + "55" : "rgba(255,255,255,0.06)"}`,
                  background: isExpanded ? `${color}22` : owned ? `${color}0d` : "rgba(255,255,255,0.03)",
                }}
                onClick={owned ? () => setExpandedGrade(isExpanded ? null : gNum) : undefined}
              >
                {owned ? (
                  <img src={relic!.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: "contain" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: 24 }}>🔒</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 800, color: owned ? color : "#475569" }}>
                  {GRADE_LABEL[gNum]}
                </span>
                {hasEnhanced && (
                  <span style={{ fontSize: 10, background: `${color}33`, color, borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>
                    {relic!.enhance}강
                  </span>
                )}
                {owned && !hasEnhanced && (
                  <span style={{ fontSize: 10, color: "#475569" }}>0강</span>
                )}
                {!owned && (
                  <span style={{ fontSize: 10, color: "#334155" }}>미보유</span>
                )}
              </div>
            );
          })}
        </div>

        {/* 선택 등급 강화 수치 표 */}
        {expandedRelic && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ color: GRADE_COLORS[expandedRelic.gradeNum], fontWeight: 700, fontSize: 13 }}>
                {expandedRelic.gradeStars} {expandedRelic.gradeName}등급
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Lv.{expandedRelic.level} {expandedRelic.enhance}강 · {getEffectLabel(expandedRelic.effectType, calcEffect(expandedRelic.gradeNum, expandedRelic.level, expandedRelic.enhance))}
              </span>
            </div>
            <div style={modalStyles.enhanceGrid}>
              {Array.from({ length: 21 }, (_, i) => i).map(enh => {
                const val = calcEffect(expandedRelic.gradeNum, expandedRelic.level, enh);
                const achieved = enh <= expandedRelic.enhance;
                const isCurrent = enh === expandedRelic.enhance;
                const color = GRADE_COLORS[expandedRelic.gradeNum];
                return (
                  <div key={enh} style={{
                    ...modalStyles.enhCell,
                    opacity: achieved ? 1 : 0.25,
                    background: isCurrent ? `${color}33` : achieved ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    border: isCurrent ? `1px solid ${color}88` : "1px solid rgba(255,255,255,0.06)",
                  }}>
                    <span style={{ fontSize: 10, color: isCurrent ? color : "#64748b", fontWeight: 700 }}>{enh}강</span>
                    <span style={{ fontSize: 12, color: isCurrent ? color : achieved ? "#e2e8f0" : "#334155", fontWeight: 700 }}>+{val}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "16px",
  },
  box: {
    background: "#0f0f1e",
    border: "1px solid rgba(3,105,161,0.3)",
    borderRadius: 20,
    padding: "24px",
    width: "100%",
    maxWidth: 520,
    maxHeight: "85vh",
    overflowY: "auto",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: 20, gap: 12,
  },
  title: { fontSize: 18, fontWeight: 900, color: "#e2e8f0", marginBottom: 4 },
  desc: { fontSize: 13, color: "#64748b" },
  close: {
    background: "none", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#64748b", cursor: "pointer",
    fontSize: 14, padding: "4px 10px", fontFamily: "inherit",
    flexShrink: 0,
  },
  enhanceGrid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
  },
  enhCell: {
    borderRadius: 8, padding: "6px 4px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
  },
  gradeRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 8,
    marginBottom: 4,
  },
  gradeCell: {
    borderRadius: 12,
    padding: "10px 6px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
    transition: "border-color 0.15s, background 0.15s",
  },
};

// ── 배틀 전적 전체 오버레이 ──────────────────────────────────────────────
const PAGE_SIZE = 5;
function BattleHistoryModal({ battles, onClose }: { battles: RecentBattle[]; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(battles.length / PAGE_SIZE);
  const pageBattles = battles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={{ ...modalStyles.box, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <div style={modalStyles.title}>⚔️ 배틀 전적</div>
            <div style={modalStyles.desc}>총 {battles.length}회 배틀</div>
          </div>
          <button style={modalStyles.close} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pageBattles.map(b => (
            <div key={b.id} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: b.iWon ? "rgba(34,197,94,0.06)" : "rgba(248,113,113,0.06)",
              border: `1px solid ${b.iWon ? "rgba(34,197,94,0.18)" : "rgba(248,113,113,0.18)"}`,
              borderRadius: 12,
              gap: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{b.iWon ? "🏆" : "💀"}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    vs {b.opponentNick}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                    {b.isAttacker ? "⚔️ 공격" : "🛡️ 방어"} · {b.battleDate}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: b.iWon ? "#4ade80" : "#f87171" }}>
                  {b.iWon ? "승리" : "패배"}
                </div>
                <div style={{ fontSize: 11, marginTop: 2, color: b.stealNet > 0 ? "#4ade80" : b.stealNet < 0 ? "#f87171" : "#475569" }}>
                  {b.stealNet > 0 ? `+${fmt(b.stealNet)}P` : b.stealNet < 0 ? `${fmt(b.stealNet)}P` : "0P"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
                color: page === 0 ? "#334155" : "#94a3b8",
                cursor: page === 0 ? "default" : "pointer",
                padding: "6px 16px", fontSize: 13, fontFamily: "inherit",
              }}
            >◀</button>
            <span style={{ fontSize: 13, color: "#64748b" }}>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
                color: page === totalPages - 1 ? "#334155" : "#94a3b8",
                cursor: page === totalPages - 1 ? "default" : "pointer",
                padding: "6px 16px", fontSize: 13, fontFamily: "inherit",
              }}
            >▶</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 닉네임 변경 이력 모달 ────────────────────────────────────────────────
function NicknameHistoryModal({ history, onClose }: { history: NicknameHistoryEntry[]; onClose: () => void }) {
  function fmtDate(s: string) {
    return new Date(s).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={{ ...modalStyles.box, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <div>
            <div style={modalStyles.title}>✏️ 닉네임 변경 내역</div>
            <div style={modalStyles.desc}>총 {history.length}회 변경</div>
          </div>
          <button style={modalStyles.close} onClick={onClose}>✕</button>
        </div>
        {history.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 14, textAlign: "center", padding: "24px 0" }}>변경 내역이 없어요.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map(h => (
              <div key={h.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10, gap: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.oldNickname || "—"}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>→</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.newNickname}</span>
                </div>
                <div style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>{fmtDate(h.changedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 도감 카드 ────────────────────────────────────────────────────────────
function CatalogCard({ entry, onClick }: { entry: CatalogEntry; onClick?: () => void }) {
  const best = entry.ownedRelics.reduce<EnrichedRelic | null>((top, r) =>
    !top || r.gradeNum > top.gradeNum || (r.gradeNum === top.gradeNum && r.effectValue > top.effectValue) ? r : top
  , null);

  return (
    <div
      style={{
        ...styles.catalogCard,
        opacity: entry.owned ? 1 : 0.45,
        border: entry.owned
          ? `1.5px solid ${best ? GRADE_COLORS[best.gradeNum] + "66" : "rgba(3,105,161,0.4)"}`
          : "1.5px solid rgba(255,255,255,0.06)",
        cursor: entry.owned ? "pointer" : "default",
      }}
      onClick={entry.owned ? onClick : undefined}
    >
      {entry.owned && best && (
        <div style={styles.catalogImgWrap}>
          <img src={best.imageUrl} alt={entry.typeName} style={styles.catalogImg}
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      {!entry.owned && (
        <div style={styles.catalogLockWrap}>
          <span style={styles.catalogLock}>🔒</span>
        </div>
      )}
      <div style={styles.catalogBody}>
        <div style={{ ...styles.catalogName, color: entry.owned && best ? GRADE_COLORS[best.gradeNum] : "#94a3b8" }}>
          {entry.typeName}
        </div>
        {entry.owned && best && (
          <div style={styles.catalogBestGrade}>
            {best.gradeStars} {best.gradeName}등급 Lv.{best.level} {best.enhance}강
          </div>
        )}
        <div style={styles.catalogDesc}>{entry.description}</div>
        {entry.owned && best && (
          <div style={{ ...styles.catalogEffect, color: GRADE_COLORS[best.gradeNum] }}>
            +{calcEffect(best.gradeNum, best.level, best.enhance)}% 효과
          </div>
        )}
        {!entry.owned && (
          <div style={styles.catalogUnowned}>미보유</div>
        )}
      </div>
    </div>
  );
}

// ── 로딩/에러 ────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={styles.page}>
      <div style={styles.loadWrap}>
        <div style={styles.loadSpinner} />
        <p style={styles.loadText}>프로필 불러오는 중…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ msg }: { msg: string }) {
  const nav = useNavigate();
  return (
    <div style={styles.page}>
      <div style={styles.loadWrap}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>😶‍🌫️</div>
        <p style={{ ...styles.loadText, color: "#f87171" }}>{msg}</p>
        <button style={styles.backBtn} onClick={() => nav("/")}>← 홈으로</button>
      </div>
    </div>
  );
}

function NoUidScreen() {
  const nav = useNavigate();
  return (
    <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...styles.loadWrap, gap: 20, maxWidth: 340, textAlign: "center", minHeight: "unset" }}>
        <div style={{ fontSize: 52 }}>🔍</div>
        <p style={{ ...styles.loadText, fontSize: 17, fontWeight: 700, color: "#e2e8f0" }}>
          프로필을 찾을 수 없어요
        </p>
        <p style={{ ...styles.loadText, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
          카카오톡에서 <span style={{ color: "#c4b5fd", fontWeight: 600 }}>@초능력자</span>에게{"\n"}
          <span style={{ color: "#a5b4fc" }}>프로필</span> 명령 후 <span style={{ color: "#a5b4fc", fontWeight: 600 }}>자세히</span> 버튼을 누르거나,
        </p>
        <p style={{ ...styles.loadText, fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
          <span style={{ color: "#a5b4fc" }}>랭킹 페이지</span>에서 유저 이름을 클릭해서 들어와 주세요!
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <a
            href={rankingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13, color: "#0EA5E9", background: "rgba(3,105,161,0.12)",
              border: "1px solid rgba(3,105,161,0.25)", borderRadius: 20,
              padding: "8px 18px", textDecoration: "none", fontWeight: 600,
            }}
          >
            🏆 랭킹 페이지로
          </a>
          <button style={{ ...styles.backBtn, margin: 0 }} onClick={() => nav("/")}>← 홈으로</button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────
const SPIN_CSS = `@keyframes prof-spin{to{transform:rotate(360deg)}}`;
const MOBILE_CSS = `
@media (max-width: 768px) {
  .battle-row { flex-direction: column !important; }
  .battle-stat-card { min-width: 0 !important; width: 100% !important; }
  .battle-history-panel { width: 100% !important; flex: none !important; box-sizing: border-box !important; }
}
@media (max-width: 640px) {
  /* 히어로 카드: 세로 스택 → 닉네임 잘림 근본 해결 */
  .prof-hero-card   {
    flex-direction: column !important;
    align-items: stretch !important;
    padding: 16px 14px !important;
    gap: 12px !important;
  }
  .prof-hero-left   { flex: none !important; width: 100% !important; }
  .prof-hero-nick   {
    font-size: 18px !important;
    white-space: normal !important;
    word-break: break-all !important;
    overflow: visible !important;
    text-overflow: clip !important;
  }
  .prof-hero-right  {
    text-align: center !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
    border-top: 1px solid rgba(255,255,255,0.07) !important;
    padding-top: 12px !important;
  }
  .prof-hero-score  { font-size: 22px !important; }
  .prof-score-unit  { font-size: 14px !important; }
  .prof-hero-title  { font-size: 11px !important; display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 4px !important; row-gap: 2px !important; }
  .prof-hero-rank   { font-size: 12px !important; }
  .prof-hero-pct    { font-size: 11px !important; }
  .prof-section-title { font-size: 14px !important; }
  .prof-stat-label  { font-size: 13px !important; }
  .prof-stat-key    { font-size: 12px !important; }
  .prof-stat-val    { font-size: 12px !important; }
  .prof-badge       { font-size: 11px !important; padding: 2px 8px !important; }
  .prof-effect-label { font-size: 11px !important; }
  .prof-effect-val  { font-size: 12px !important; }
  .prof-tab         { font-size: 12px !important; padding: 6px 10px !important; }
  .prof-stat-card   { padding: 14px 14px 12px !important; }
  .prof-section     { padding: 14px !important; }
  .prof-superpower-val { font-size: 15px !important; word-break: break-all; }
  .prof-content     { gap: 14px !important; }
  .prof-achievement-strip { padding: 12px 14px !important; }
  .prof-relic-meta  { font-size: 10px !important; }
}
`;

interface SuperpowerStats {
  superpowerScore: number;
  relicAssetScore: number;
  totalPower: number;
  superpowerRank: number;
  relicAssetRank: number;
  totalPowerRank: number;
}

export default function ProfilePage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const uid = params.get("uid") ?? "";
  const [data, setData] = useState<ProfileData | null>(null);
  const ogTitle = data?.user.nickname
    ? `초능력자 프로필 - ${data.user.nickname}`
    : "초능력자 프로필";
  useOgMeta({
    title: ogTitle,
    description: "초능력자 카카오톡 챗봇 유저 프로필. 포인트·유물·배틀 전적을 한눈에 확인하세요.",
    url: uid ? `https://chosung.app/profile?uid=${uid}` : "https://chosung.app/profile",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [relicTab, setRelicTab] = useState<"equipped" | "storage" | "catalog">("equipped");
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogEntry | null>(null);
  const [showBattleHistory, setShowBattleHistory] = useState(false);
  const [showNickHistory, setShowNickHistory] = useState(false);
  const [openAchievementCat, setOpenAchievementCat] = useState<string | null>(null);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<TitleDef | null>(null);
  const [superpowerStats, setSuperpowerStats] = useState<SuperpowerStats | null>(null);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth <= 640;

  useEffect(() => {
    if (!isMobile && relicTab === "catalog") setRelicTab("equipped");
  }, [isMobile]);

  useEffect(() => {
    const anyOpen = !!(showAllAchievements || openAchievementCat || showBattleHistory || showNickHistory || selectedCatalog);
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showAllAchievements, openAchievementCat, showBattleHistory, showNickHistory, selectedCatalog]);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const profilePromise = fetch(`${API}/profile/${encodeURIComponent(uid)}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); throw new Error("not_found"); }
        if (!r.ok) throw new Error("서버 오류가 발생했어요.");
        return r.json() as Promise<ProfileData>;
      });

    const rankingPromise = fetch(`${API}/kakao/superpower-ranking`)
      .then(r => r.json() as Promise<{ ranking?: { userId: string; superpowerScore: number; relicAssetScore: number; totalPower: number; rank: number }[] }>)
      .catch(() => null);

    Promise.all([profilePromise, rankingPromise])
      .then(([profileData, rankingData]) => {
        setData(profileData);
        if (rankingData?.ranking) {
          const ranking = rankingData.ranking;
          const entry = ranking.find(e => e.userId === uid);
          if (entry) {
            const byRelic = [...ranking].sort((a, b) => b.relicAssetScore - a.relicAssetScore);
            const byPower = [...ranking].sort((a, b) => b.totalPower - a.totalPower);
            const relicAssetRank = byRelic.findIndex(e => e.userId === uid) + 1;
            const totalPowerRank = byPower.findIndex(e => e.userId === uid) + 1;
            setSuperpowerStats({
              superpowerScore: entry.superpowerScore,
              relicAssetScore: entry.relicAssetScore,
              totalPower: entry.totalPower,
              superpowerRank: entry.rank,
              relicAssetRank,
              totalPowerRank,
            });
          }
        }
        setLoading(false);
      })
      .catch(e => { if ((e as Error).message !== "not_found") setError((e as Error).message); setLoading(false); });
  }, [uid]);

  if (!uid || notFound) return <NoUidScreen />;
  if (loading) return <LoadingSkeleton />;
  if (error || !data) return <ErrorScreen msg={error || "알 수 없는 오류"} />;

  const { user, relics, relicCatalog, attendanceHistory, battleStats, recentBattles, titles } = data;
  const allTitles    = titles?.all ?? [];
  const earnedTitles = allTitles.filter(t => t.earned);
  const topTitle     = titles?.top ?? null;
  const eff = relics.effects;

  function getTitleProgress(id: string): { current: number; max: number; label: string; compound?: string } | null {
    const u = user;
    const allRelicsArr = [
      ...(relics.mainRelic ? [relics.mainRelic] : []),
      ...relics.storageRelics,
    ];
    const uniqueTypes  = new Set(allRelicsArr.map(r => r.typeId)).size;
    const maxGrade     = allRelicsArr.reduce((m, r) => Math.max(m, r.gradeNum), 0);
    const maxEnhance   = allRelicsArr.reduce((m, r) => Math.max(m, r.enhance), 0);
    const aGradePlus   = allRelicsArr.filter(r => r.gradeNum >= 4).length;
    const sGrade       = allRelicsArr.filter(r => r.gradeNum >= 5).length;
    const pctNow       = u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0;
    const map: Record<string, { current: number; max: number; label: string; compound?: string }> = {
      chosung_00: { current: u.correct, max: 100,     label: "정답" },
      chosung_01: { current: u.correct, max: 1_000,   label: "정답" },
      chosung_02: { current: u.correct, max: 5_000,   label: "정답" },
      chosung_03: { current: u.correct, max: 15_000,  label: "정답" },
      chosung_04: { current: u.correct, max: 40_000,  label: "정답" },
      chosung_05: { current: u.correct, max: 80_000,  label: "정답" },
      chosung_06: { current: u.correct, max: 150_000, label: "정답" },
      chosung_07: { current: u.correct, max: 300_000, label: "정답" },
      chosung_08: { current: u.correct, max: 600_000, label: "정답" },
      chosung_09: { current: Math.min(pctNow, 90), max: 90, label: "%", compound: `시도 ${fmt(u.total)}/2,000회 · 정답률 ${pctNow}% (목표 90%)` },
      chosung_10: { current: Math.min(pctNow, 95), max: 95, label: "%", compound: `시도 ${fmt(u.total)}/5,000회 · 정답률 ${pctNow}% (목표 95%)` },
      chosung_11: { current: u.total, max: 20_000, label: "시도" },
      hunmin_00:  { current: u.hunminWins, max: 10,    label: "승" },
      hunmin_01:  { current: u.hunminWins, max: 30,    label: "승" },
      hunmin_02:  { current: u.hunminWins, max: 100,   label: "승" },
      hunmin_03:  { current: u.hunminWins, max: 250,   label: "승" },
      hunmin_04:  { current: u.hunminWins, max: 500,   label: "승" },
      hunmin_05:  { current: u.hunminWins, max: 1_000, label: "승" },
      hunmin_06:  { current: u.hunminWins, max: 2_000, label: "승" },
      hunmin_07:  { current: u.hunminWins, max: 4_000, label: "승" },
      hunmin_08:  { current: u.hunminWins, max: 8_000, label: "승" },
      hunmin_09:  { current: u.hunminMax,  max: 10,    label: "개" },
      hunmin_10:  { current: u.hunminMax,  max: 20,    label: "개" },
      hunmin_11:  { current: u.hunminTotal, max: 5_000, label: "회 참여" },
      jamo_00:    { current: u.jamoTotalCount, max: 50,     label: "판" },
      jamo_01:    { current: u.jamoTotalCount, max: 200,    label: "판" },
      jamo_02:    { current: u.jamoTotalCount, max: 1_000,  label: "판" },
      jamo_03:    { current: u.jamoTotalCount, max: 3_000,  label: "판" },
      jamo_04:    { current: u.jamoTotalCount, max: 8_000,  label: "판" },
      jamo_05:    { current: u.jamoTotalCount, max: 20_000, label: "판" },
      jamo_06:    { current: u.jamoTotalCount, max: 50_000, label: "판" },
      jamo_07:    { current: u.jamoBestStreak, max: 50,  label: "회 연속" },
      jamo_08:    { current: u.jamoBestStreak, max: 150, label: "회 연속" },
      jamo_09:    { current: u.jamoBestStreak, max: 400, label: "회 연속" },
      jamo_10:    { current: u.jamoHardCount,  max: 500,   label: "판 (어려움)" },
      jamo_11:    { current: u.jamoHardCount,  max: 3_000, label: "판 (어려움)" },
      jamo_12:    {
        current: Math.min(u.jamoEasyCount, 100) + Math.min(u.jamoNormalCount, 100) + Math.min(u.jamoHardCount, 100),
        max: 300,
        label: "판 합계",
        compound: `쉬움 ${Math.min(u.jamoEasyCount, 100)}/100 · 보통 ${Math.min(u.jamoNormalCount, 100)}/100 · 어려움 ${Math.min(u.jamoHardCount, 100)}/100`,
      },
      relic_00:   { current: Math.min(uniqueTypes, 1), max: 1, label: "종" },
      relic_01:   { current: Math.min(uniqueTypes, 3), max: 3, label: "종" },
      relic_02:   { current: Math.min(uniqueTypes, 5), max: 5, label: "종" },
      relic_03:   { current: Math.min(uniqueTypes, 8), max: 8, label: "종" },
      relic_04:   { current: Math.min(maxGrade, 3), max: 3, label: "등급 달성" },
      relic_05:   { current: Math.min(maxGrade, 4), max: 4, label: "등급 달성" },
      relic_06:   { current: Math.min(aGradePlus, 3), max: 3, label: "개 (A급 이상)" },
      relic_07:   { current: Math.min(maxGrade, 5), max: 5, label: "등급 달성" },
      relic_08:   { current: Math.min(sGrade, 2), max: 2, label: "개 (S급)" },
      relic_09:   { current: Math.min(sGrade, 4), max: 4, label: "개 (S급)" },
      relic_10:   { current: Math.min(maxEnhance, 5),  max: 5,  label: "강" },
      relic_11:   { current: Math.min(maxEnhance, 10), max: 10, label: "강" },
      relic_12:   { current: Math.min(maxEnhance, 20), max: 20, label: "강" },
      relic_13:   { current: Math.min(maxGrade, 6), max: 6, label: "등급 달성" },
      relic_14:   { current: Math.min(allRelicsArr.filter(r => r.gradeNum >= 6).length, 2), max: 2, label: "개 (SS급)" },
      point_00:   { current: u.score, max: 10_000,           label: "P" },
      point_01:   { current: u.score, max: 100_000,          label: "P" },
      point_02:   { current: u.score, max: 1_000_000,        label: "P" },
      point_03:   { current: u.score, max: 5_000_000,        label: "P" },
      point_04:   { current: u.score, max: 20_000_000,       label: "P" },
      point_05:   { current: u.score, max: 60_000_000,       label: "P" },
      point_06:   { current: u.score, max: 200_000_000,      label: "P" },
      point_07:   { current: u.score, max: 600_000_000,      label: "P" },
      point_08:   { current: u.score, max: 2_000_000_000,    label: "P" },
      point_09:   { current: u.score, max: 8_000_000_000,    label: "P" },
    };
    return map[id] ?? null;
  }

  const CAT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
    "초성퀴즈": { color: "#38bdf8", bg: "rgba(56,189,248,0.12)",  border: "rgba(56,189,248,0.3)" },
    "훈민정음": { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
    "자모연성": { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  border: "rgba(251,146,60,0.3)" },
    "유물":     { color: "#facc15", bg: "rgba(250,204,21,0.12)",  border: "rgba(250,204,21,0.3)" },
    "포인트":   { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.3)" },
  };


  const effectRows = [
    { label: "모든 게임 보너스",     val: eff.allBonus,          icon: "🎯" },
    { label: "초성퀴즈 보너스",      val: eff.chosungBonus,      icon: "⚡" },
    { label: "훈민정음 보너스",      val: eff.hunminBonus,       icon: "📖" },
    { label: "자모연성 보너스",      val: eff.jamoBonus,         icon: "✨" },
    { label: "콤보 보너스",         val: eff.comboBonus,         icon: "🔥" },
    { label: "강화 비용 감소",       val: eff.enhanceCostReduce, icon: "🔧" },
    { label: "경험치 보너스",        val: eff.expBonus,          icon: "📈" },
    { label: "보관함 효과 보너스",   val: eff.storageBonus,      icon: "🗃️" },
  ].filter(e => e.val > 0);

  return (
    <div style={styles.page}>
      <PatchNoticeModal />
      <style>{SPIN_CSS + MOBILE_CSS}</style>
      {/* ── 상단 네비 ── */}
      <nav style={styles.nav}>
        <button style={styles.navLogo} onClick={() => nav("/")}>
          <img src={heroImage} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={styles.navLogoText}>초능력자</span>
        </button>
        <span style={styles.navTitle}>프로필</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <a
            href={rankingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, color: "#0EA5E9",
              background: "rgba(3,105,161,0.12)", border: "1px solid rgba(3,105,161,0.25)",
              borderRadius: 20, padding: "4px 12px", textDecoration: "none",
              fontWeight: 600, whiteSpace: "nowrap" as const,
            }}
          >
            🏆 전체랭킹
          </a>
          <a
            href="/donate"
            style={{
              fontSize: 12, color: "#c4b5fd",
              background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 20, padding: "4px 12px", textDecoration: "none",
              fontWeight: 600, whiteSpace: "nowrap" as const,
            }}
          >
            💜 후원
          </a>
        </div>
      </nav>

      {selectedCatalog && (
        <CatalogDetailModal entry={selectedCatalog} onClose={() => setSelectedCatalog(null)} />
      )}
      {showBattleHistory && (
        <BattleHistoryModal battles={data?.recentBattles ?? []} onClose={() => setShowBattleHistory(false)} />
      )}
      {showNickHistory && (
        <NicknameHistoryModal history={data?.nicknameHistory ?? []} onClose={() => setShowNickHistory(false)} />
      )}

      {showAllAchievements && (
        <div
          onClick={() => setShowAllAchievements(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0e0e1a", border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: 20, padding: "20px 16px 20px",
              width: "100%", maxWidth: isMobile ? 400 : 680,
              maxHeight: "92vh", overflow: "auto",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#e2e8f0" }}>🏅 획득 업적</span>
                <span style={{ fontSize: 12, color: "#475569", marginLeft: 10 }}>
                  <strong style={{ color: "#a78bfa" }}>{earnedTitles.length}</strong> / {allTitles.length}개 획득
                </span>
              </div>
              <button
                onClick={() => setShowAllAchievements(false)}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
              >✕</button>
            </div>
            {(["초성퀴즈", "훈민정음", "자모연성", "유물", "포인트"] as const).map(cat => {
              const catTitles = allTitles.filter(t => t.category === cat);
              const c = CAT_COLORS[cat]!;
              const earnedCount = catTitles.filter(t => t.earned).length;
              return (
                <div key={cat} style={{ marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.color, letterSpacing: "0.04em" }}>{cat}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>{earnedCount}/{catTitles.length}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 6 }}>
                    {catTitles.map(t => {
                      const isTop = t.id === topTitle?.id;
                      return (
                        <div key={t.id} title={t.description} onClick={() => setSelectedAchievement(t)} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: t.earned ? (isTop ? c.bg : "rgba(255,255,255,0.05)") : "rgba(255,255,255,0.02)",
                          border: `1px solid ${t.earned ? (isTop ? c.border : "rgba(255,255,255,0.09)") : "rgba(255,255,255,0.03)"}`,
                          borderRadius: 10, padding: "8px 10px",
                          opacity: t.earned ? 1 : 0.45,
                          cursor: "pointer",
                        }}>
                          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, filter: t.earned ? "none" : "grayscale(1)" }}>{t.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 11, fontWeight: 700,
                              color: t.earned ? (isTop ? c.color : "#e2e8f0") : "#3d4a5c",
                              display: "flex", alignItems: "flex-start", gap: 4, flexWrap: "wrap" as const,
                            }}>
                              {t.name}
                              {isTop && t.earned && (
                                <span style={{ fontSize: 8, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: "1px 4px", flexShrink: 0 }}>대표</span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: t.earned ? "#64748b" : "#2a3340", marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                          </div>
                          {!t.earned && <span style={{ fontSize: 11, color: "#2a3340", flexShrink: 0 }}>🔒</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedAchievement && (() => {
        const t = selectedAchievement;
        const c = CAT_COLORS[t.category] ?? CAT_COLORS["포인트"]!;
        const prog = getTitleProgress(t.id);
        const pct  = prog ? Math.min(100, Math.round((prog.current / prog.max) * 100)) : null;
        const remaining = prog && !t.earned ? Math.max(0, prog.max - prog.current) : 0;
        return (
          <div
            onClick={() => setSelectedAchievement(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 410,
              background: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#0e0e1a",
                border: `1px solid ${t.earned ? c.border : "rgba(255,255,255,0.1)"}`,
                borderRadius: 18, padding: "20px 20px 18px",
                width: "100%", maxWidth: isMobile ? 260 : 380,
                boxShadow: `0 12px 40px rgba(0,0,0,0.7)${t.earned ? `, 0 0 0 1px ${c.border}` : ""}`,
                display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 0,
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <button
                  onClick={() => setSelectedAchievement(null)}
                  style={{ background: "none", border: "none", color: "#475569", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 2 }}
                >✕</button>
              </div>

              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                padding: "3px 10px", borderRadius: 20, marginBottom: 12,
                background: t.earned ? "rgba(74,222,128,0.15)" : "rgba(100,116,139,0.15)",
                border: `1px solid ${t.earned ? "rgba(74,222,128,0.3)" : "rgba(100,116,139,0.25)"}`,
                color: t.earned ? "#4ade80" : "#64748b",
              }}>
                {t.earned ? "✅ 수집됨" : "🔒 미수집"}
              </span>

              <span style={{
                fontSize: 44, lineHeight: 1,
                filter: t.earned ? "none" : "grayscale(0.6)",
                marginBottom: 10,
              }}>{t.icon}</span>

              <div style={{ fontSize: 14, fontWeight: 800, color: t.earned ? c.color : "#94a3b8", marginBottom: 4, textAlign: "center" as const }}>
                {t.name}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: prog ? 14 : 4, textAlign: "center" as const, lineHeight: 1.5 }}>
                {t.description}
              </div>

              {prog && (
                <div style={{ width: "100%", marginTop: 2 }}>
                  <div style={{
                    height: 6, borderRadius: 3,
                    background: "rgba(255,255,255,0.07)",
                    overflow: "hidden", marginBottom: 7,
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 3,
                      background: t.earned ? c.color : "rgba(100,116,139,0.6)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>

                  {prog.compound ? (
                    <div style={{ fontSize: 10, color: "#475569", textAlign: "center" as const, lineHeight: 1.6 }}>
                      {prog.compound}
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#475569" }}>
                        {fmt(prog.current)} / {fmt(prog.max)} {prog.label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: t.earned ? "#4ade80" : "#94a3b8",
                      }}>
                        {t.earned ? "달성!" : `${fmt(remaining)} ${prog.label} 남음`}
                      </span>
                    </div>
                  )}

                  {prog.compound && !t.earned && (
                    <div style={{ textAlign: "center" as const, marginTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>
                        {fmt(remaining)} 남음
                      </span>
                    </div>
                  )}
                  {prog.compound && t.earned && (
                    <div style={{ textAlign: "center" as const, marginTop: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80" }}>달성!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {openAchievementCat && (() => {
        const catKey = openAchievementCat;
        const c = CAT_COLORS[catKey] ?? CAT_COLORS["포인트"]!;
        const catAll    = allTitles.filter(t => t.category === catKey);
        const catEarned = catAll.filter(t => t.earned);
        return (
          <div
            onClick={() => setOpenAchievementCat(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 300,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#0e0e1a",
                border: `1px solid ${c.border}`,
                borderRadius: 20, padding: "24px 20px 20px",
                width: "100%", maxWidth: isMobile ? 460 : 680,
                maxHeight: "80vh", overflow: "auto",
                boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px ${c.border}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 16, color: c.color }}>{catKey}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginLeft: 6 }}>업적</span>
                  <span style={{ fontSize: 12, color: "#475569", marginLeft: 8 }}>
                    {catEarned.length}/{catAll.length}개 획득
                  </span>
                </div>
                <button
                  onClick={() => setOpenAchievementCat(null)}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}
                >✕</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {catAll.map(t => {
                  const isTop = t.id === topTitle?.id;
                  return (
                    <div key={t.id} onClick={() => setSelectedAchievement(t)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: t.earned ? (isTop ? c.bg : "rgba(255,255,255,0.05)") : "rgba(255,255,255,0.02)",
                      border: `1px solid ${t.earned ? (isTop ? c.border : "rgba(255,255,255,0.09)") : "rgba(255,255,255,0.03)"}`,
                      borderRadius: 10, padding: "10px 14px",
                      opacity: t.earned ? 1 : 0.45,
                      transition: "opacity 0.15s",
                      cursor: "pointer",
                    }}>
                      <span style={{ fontSize: 20, flexShrink: 0, filter: t.earned ? "none" : "grayscale(1)" }}>{t.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.earned ? (isTop ? c.color : "#e2e8f0") : "#3d4a5c", display: "flex", alignItems: "center", gap: 6 }}>
                          {t.name}
                          {isTop && t.earned && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: "1px 5px" }}>대표</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: t.earned ? "#64748b" : "#2a3340", marginTop: 2 }}>{t.description}</div>
                      </div>
                      {!t.earned && <span style={{ fontSize: 14, color: "#2a3340", flexShrink: 0 }}>🔒</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="prof-content" style={styles.content}>

        {/* ── 히어로 카드 ── */}
        <div className="prof-hero-card" style={styles.heroCard}>
          <div className="prof-hero-left" style={{ ...styles.heroLeft, minWidth: 0, flex: 1 }}>
            <div style={{ ...styles.avatar, ...(isMobile ? { width: 48, height: 48, fontSize: 20 } : {}) }}>
              {user.nickname.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0, overflow: "hidden", flex: 1 }}>
              <div className="prof-hero-nick" style={{ ...styles.heroNick, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nickname}</div>
              <div className="prof-hero-title" style={styles.heroTitle}>
                <span>{getScoreTitle(user.topPct)}</span>
                {topTitle && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#a78bfa", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 6, padding: "2px 7px" }}>
                    {topTitle.icon} {topTitle.name}
                  </span>
                )}
              </div>
              <div style={styles.heroBadges}>
                {user.attendedToday
                  ? <span className="prof-badge" style={{ ...styles.badge, background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>✅ 오늘 출석 완료</span>
                  : <span className="prof-badge" style={{ ...styles.badge, background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>❌ 미출석</span>
                }
              </div>
              {/* 장착 유물 요약 */}
              {relics.mainRelic ? (
                <div style={styles.heroRelicRow}>
                  <img src={relics.mainRelic.imageUrl} alt="" style={styles.heroRelicImg}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span style={{ color: GRADE_COLORS[relics.mainRelic.gradeNum], fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                    {relics.mainRelic.gradeStars} {relics.mainRelic.name}
                  </span>
                  <span style={{ ...styles.heroRelicMeta, flexShrink: 0 }}>
                    Lv.{relics.mainRelic.level} {relics.mainRelic.enhance}강 · +{getCombinedEffectVal(relics.mainRelic.effectType, eff)}%
                  </span>
                </div>
              ) : (
                <div style={styles.heroRelicRow}>
                  <span style={{ fontSize: 12, color: "#475569" }}>🔮 장착 유물 없음</span>
                </div>
              )}
            </div>
          </div>
          <div className="prof-hero-right" style={styles.heroRight}>
            {(() => {
              const spRank   = superpowerStats?.superpowerRank ?? 0;
              const spScore  = superpowerStats?.superpowerScore ?? null;
              const rankPage = spRank > 0 ? Math.ceil(spRank / 30) : 1;
              const rankUrl  = rankingUrl(rankPage);
              const spTopPct = spRank > 0 && user.totalUsers > 0
                ? Math.round((spRank / user.totalUsers) * 100)
                : 0;
              const linkStyle: React.CSSProperties = {
                color: "inherit",
                textDecoration: "underline",
                textDecorationColor: "rgba(3,105,161,0.5)",
                textUnderlineOffset: 3,
                cursor: "pointer",
              };
              return (
                <>
                  <a href={rankUrl} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, textDecoration: "none" }}>
                    <div className="prof-hero-score" style={styles.heroScore}>
                      {spScore !== null ? fmt(spScore) : fmt(user.score)}
                      <span className="prof-score-unit" style={styles.heroScoreUnit}>
                        {spScore !== null ? "점" : "P"}
                      </span>
                    </div>
                  </a>
                  <div style={styles.heroRankRow}>
                    <span style={styles.rankEmoji}>{getRankEmoji(spRank > 0 ? spRank : user.rank)}</span>
                    {spRank > 0 ? (
                      <a href={rankUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                        <span className="prof-hero-rank" style={styles.heroRank}>
                          {spRank}위/{fmt(user.totalUsers)}명
                        </span>
                      </a>
                    ) : (
                      <span className="prof-hero-rank" style={styles.heroRank}>순위 없음</span>
                    )}
                  </div>
                  {spTopPct > 0 && (
                    <div className="prof-hero-pct" style={styles.heroTopPct}>
                      상위 {spTopPct}%
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* ── 초능력자 지표 ── */}
        {superpowerStats && (
          <div style={styles.superpowerCard}>
            <div style={styles.superpowerItem}>
              <div style={styles.superpowerIcon}>💰</div>
              <div className="prof-superpower-val" style={styles.superpowerVal}>{fmt(user.score)}P</div>
              <div style={styles.superpowerLabel}>포인트</div>
              {user.rank > 0 && (
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{user.rank}위</div>
              )}
            </div>
            <div style={styles.superpowerDivider} />
            <div style={styles.superpowerItem}>
              <div style={styles.superpowerIcon}>🏺</div>
              <div className="prof-superpower-val" style={styles.superpowerVal}>{fmt(superpowerStats.relicAssetScore)}P</div>
              <div style={styles.superpowerLabel}>유물 자산</div>
              {superpowerStats.relicAssetRank > 0 && (
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{superpowerStats.relicAssetRank}위</div>
              )}
            </div>
            <div style={styles.superpowerDivider} />
            <div style={styles.superpowerItem}>
              <div style={styles.superpowerIcon}>⚔️</div>
              <div className="prof-superpower-val" style={styles.superpowerVal}>{superpowerStats.totalPower.toFixed(2)}</div>
              <div style={styles.superpowerLabel}>전투력</div>
              {superpowerStats.totalPowerRank > 0 && (
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{superpowerStats.totalPowerRank}위</div>
              )}
            </div>
          </div>
        )}

        {/* ── 업적 칭호 (컴팩트) ── */}
        <div className="prof-achievement-strip" style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "16px 20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: earnedTitles.length > 0 ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>🏅 획득 업적</span>
              <span style={{ fontSize: 12, color: "#475569" }}>{earnedTitles.length}/{allTitles.length}</span>
              {topTitle && (
                <span style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 20,
                  background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)",
                  color: "#c4b5fd", fontWeight: 700,
                }}>
                  {topTitle.icon} {topTitle.name}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAllAchievements(true)}
              style={{
                fontSize: 12, color: "#64748b",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
                flexShrink: 0,
              }}
            >
              더보기 ▾
            </button>
          </div>
          {earnedTitles.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
              {earnedTitles.map(t => {
                const c = CAT_COLORS[t.category] ?? CAT_COLORS["포인트"]!;
                const isTop = t.id === topTitle?.id;
                return (
                  <span key={t.id} title={t.description} onClick={() => setSelectedAchievement(t)} style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 20,
                    background: isTop ? c.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isTop ? c.border : "rgba(255,255,255,0.08)"}`,
                    color: isTop ? c.color : "#94a3b8",
                    fontWeight: isTop ? 700 : 500,
                    cursor: "pointer",
                  }}>
                    {t.icon} {t.name}
                  </span>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic" }}>
              아직 획득한 업적이 없어요. 게임을 플레이해서 칭호를 모아보세요!
            </div>
          )}
        </div>

        {/* ── 게임 통계 3열 ── */}
        <div style={styles.statsGrid}>
          {/* 초성퀴즈 */}
          <div className="prof-stat-card" style={styles.statCard}>
            <div style={styles.statIcon}>⚡</div>
            <div className="prof-stat-label" style={styles.statLabel}>초성퀴즈</div>
            <div style={styles.statRows}>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>맞힌 문제</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(user.correct)}문제</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>총 도전</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(user.total)}회</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>정답률</span>
                <span className="prof-stat-val" style={{ ...styles.statVal, color: user.accuracy >= 70 ? "#4ade80" : user.accuracy >= 50 ? "#facc15" : "#f87171" }}>
                  {user.accuracy}%
                </span>
              </div>
            </div>
            <div style={styles.accuracyBar}>
              <div style={{ ...styles.accuracyFill, width: `${user.accuracy}%` }} />
            </div>
          </div>

          {/* 훈민정음 */}
          <div className="prof-stat-card" style={styles.statCard}>
            <div style={styles.statIcon}>📖</div>
            <div className="prof-stat-label" style={styles.statLabel}>훈민정음</div>
            <div style={styles.statRows}>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>우승 횟수</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(user.hunminWins)}회</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>최다 정답 (1게임)</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(user.hunminMax)}개</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>총 정답</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(user.hunminTotal)}개</span>
              </div>
            </div>
          </div>

          {/* 자모연성 */}
          <div className="prof-stat-card" style={styles.statCard}>
            <div style={styles.statIcon}>✨</div>
            <div className="prof-stat-label" style={styles.statLabel}>자모연성</div>
            <div style={styles.statRows}>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>총 플레이 횟수</span>
                <span className="prof-stat-val" style={{ ...styles.statVal, color: "#0EA5E9" }}>{fmt(user.jamoTotalCount)}회</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>선호 난이도</span>
                <span className="prof-stat-val" style={{ ...styles.statVal, color: "#38BDF8" }}>
                  {(() => {
                    const e = user.jamoEasyCount, n = user.jamoNormalCount, h = user.jamoHardCount;
                    if (e === 0 && n === 0 && h === 0) return "없음";
                    if (e >= n && e >= h) return `쉬움 (${fmt(e)}회)`;
                    if (n >= e && n >= h) return `보통 (${fmt(n)}회)`;
                    return `어려움 (${fmt(h)}회)`;
                  })()}
                </span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>마지막 플레이</span>
                <span className="prof-stat-val" style={{ ...styles.statVal, fontSize: 11 }}>
                  {user.lastJamoAt
                    ? new Date(user.lastJamoAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : (user.lastJamoDate || "없음")}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── 배틀 + 배틀 전적 (데스크탑/태블릿: 가로 배치) ── */}
        <div className="battle-row" style={styles.battleRow}>
          {/* 배틀 통계 카드 */}
          <div className="battle-stat-card" style={{ ...styles.statCard, ...styles.battleStatCard }}>
            <div style={styles.statIcon}>⚔️</div>
            <div className="prof-stat-label" style={styles.statLabel}>배틀</div>
            <div style={styles.statRows}>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>총 배틀</span>
                <span className="prof-stat-val" style={styles.statVal}>{fmt(battleStats.total)}회</span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>승 / 패</span>
                <span className="prof-stat-val" style={styles.statVal}>
                  <span style={{ color: "#4ade80" }}>{fmt(battleStats.wins)}승</span>
                  <span style={{ color: "#64748b", margin: "0 4px" }}>/</span>
                  <span style={{ color: "#f87171" }}>{fmt(battleStats.losses)}패</span>
                </span>
              </div>
              <div style={styles.statRow}>
                <span className="prof-stat-key" style={styles.statKey}>승률</span>
                <span className="prof-stat-val" style={{
                  ...styles.statVal,
                  color: battleStats.winRate >= 60 ? "#4ade80" : battleStats.winRate >= 40 ? "#facc15" : "#f87171"
                }}>
                  {battleStats.total > 0 ? `${battleStats.winRate}%` : "기록 없음"}
                </span>
              </div>
            </div>
            {battleStats.total > 0 && (
              <div style={styles.accuracyBar}>
                <div style={{ ...styles.accuracyFill, width: `${battleStats.winRate}%`, background: "linear-gradient(90deg, #22c55e, #4ade80)" }} />
              </div>
            )}
          </div>

          {/* 배틀 전적 패널 */}
          {recentBattles.length > 0 ? (
            <div className="battle-history-panel" style={styles.battleHistoryPanel}>
              <div className="prof-section-title" style={{ ...styles.sectionTitle, marginBottom: 12 }}>⚔️ 배틀 전적</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentBattles.slice(0, 2).map(b => (
                  <div key={b.id} style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: b.iWon ? "rgba(34,197,94,0.06)" : "rgba(248,113,113,0.06)",
                    border: `1px solid ${b.iWon ? "rgba(34,197,94,0.18)" : "rgba(248,113,113,0.18)"}`,
                    borderRadius: 10,
                    gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{b.iWon ? "🏆" : "💀"}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          vs {b.opponentNick}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {b.isAttacker ? "⚔️ 공격" : "🛡️ 방어"} · {b.battleDate}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: b.iWon ? "#4ade80" : "#f87171" }}>
                        {b.iWon ? "승리" : "패배"}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2, color: b.stealNet > 0 ? "#4ade80" : b.stealNet < 0 ? "#f87171" : "#475569" }}>
                        {b.stealNet > 0 ? `+${fmt(b.stealNet)}P` : b.stealNet < 0 ? `${fmt(b.stealNet)}P` : "0P"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {recentBattles.length > 2 && (
                <button
                  onClick={() => setShowBattleHistory(true)}
                  style={styles.showMoreBtn}
                >
                  전체 보기 ({recentBattles.length}회) ▶
                </button>
              )}
            </div>
          ) : (
            <div className="battle-history-panel" style={{ ...styles.battleHistoryPanel, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>아직 배틀 기록이 없어요.</span>
            </div>
          )}
        </div>

        {/* ── 유물 효과 요약 (보유 효과 있을 때만) ── */}
        {effectRows.length > 0 && (
          <div style={styles.effectCard}>
            <div className="prof-section-title" style={styles.sectionTitle}>🔮 현재 유물 효과</div>
            <div style={styles.effectGrid}>
              {effectRows.map(e => (
                <div key={e.label} style={styles.effectItem}>
                  <span style={styles.effectIcon}>{e.icon}</span>
                  <span className="prof-effect-label" style={styles.effectLabel}>{e.label}</span>
                  <span className="prof-effect-val" style={styles.effectVal}>+{e.val}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 유물 섹션 ── */}
        <div className="prof-section" style={styles.section}>
          <div className="prof-section-title" style={styles.sectionTitle}>🗡️ 유물</div>

          {isMobile ? (
            /* ── 모바일: 3탭 단일 콘텐츠 ── */
            <>
              <div style={styles.tabRow}>
                {(["equipped", "storage", "catalog"] as const).map(tab => {
                  const labels: Record<string, string> = {
                    equipped: `장착 ${relics.mainRelic ? "1" : "0"}`,
                    storage:  `보관함 ${relics.storageRelics.length}/${relics.capacity}`,
                    catalog:  "도감",
                  };
                  return (
                    <button
                      key={tab}
                      className="prof-tab"
                      style={{ ...styles.tab, ...(relicTab === tab ? styles.tabActive : {}) }}
                      onClick={() => setRelicTab(tab)}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>
              {relicTab === "equipped" && (
                relics.mainRelic
                  ? <div style={styles.relicSingle}><RelicCard relic={relics.mainRelic} badge="장착 중" onClick={() => { const e = relicCatalog.find(e => e.typeId === relics.mainRelic!.typeId); if (e) setSelectedCatalog(e); }} /></div>
                  : <div style={styles.emptyBox}>장착된 유물이 없어요.</div>
              )}
              {relicTab === "storage" && (
                relics.storageRelics.length > 0
                  ? <div style={styles.relicGrid}>{relics.storageRelics.map(r => <RelicCard key={r.relicId} relic={r} onClick={() => { const e = relicCatalog.find(e => e.typeId === r.typeId); if (e) setSelectedCatalog(e); }} />)}</div>
                  : <div style={styles.emptyBox}>보관함이 비어 있어요.</div>
              )}
              {relicTab === "catalog" && (
                <div style={styles.catalogGrid}>
                  {relicCatalog.map(e => <CatalogCard key={e.typeId} entry={e} onClick={() => setSelectedCatalog(e)} />)}
                </div>
              )}
            </>
          ) : (
            /* ── 데스크탑/태블릿: 2패널 ── */
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={styles.tabRow}>
                  {(["equipped", "storage"] as const).map(tab => {
                    const labels: Record<string, string> = {
                      equipped: `장착 ${relics.mainRelic ? "1" : "0"}`,
                      storage:  `보관함 ${relics.storageRelics.length}/${relics.capacity}`,
                    };
                    return (
                      <button
                        key={tab}
                        className="prof-tab"
                        style={{ ...styles.tab, ...(relicTab === tab ? styles.tabActive : {}) }}
                        onClick={() => setRelicTab(tab)}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>
                {relicTab === "equipped" && (
                  relics.mainRelic
                    ? <div style={styles.relicSingle}><RelicCard relic={relics.mainRelic} badge="장착 중" onClick={() => { const e = relicCatalog.find(e => e.typeId === relics.mainRelic!.typeId); if (e) setSelectedCatalog(e); }} /></div>
                    : <div style={styles.emptyBox}>장착된 유물이 없어요.</div>
                )}
                {relicTab === "storage" && (
                  relics.storageRelics.length > 0
                    ? <div style={styles.relicGrid}>{relics.storageRelics.map(r => <RelicCard key={r.relicId} relic={r} onClick={() => { const e = relicCatalog.find(e => e.typeId === r.typeId); if (e) setSelectedCatalog(e); }} />)}</div>
                    : <div style={styles.emptyBox}>보관함이 비어 있어요.</div>
                )}
              </div>
              <div style={{ flex: 3, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 12 }}>📖 도감</div>
                <div style={styles.catalogGrid}>
                  {relicCatalog.map(e => <CatalogCard key={e.typeId} entry={e} onClick={() => setSelectedCatalog(e)} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 출석 달력 ── */}
        <div className="prof-section" style={styles.section}>
          <div className="prof-section-title" style={styles.sectionTitle}>🗓️ 출석 캘린더</div>
          <div style={styles.attMeta}>
            총 <strong style={{ color: "#38BDF8" }}>{attendanceHistory.length}일</strong> 출석
          </div>
          <AttendanceCalendar history={attendanceHistory} />
        </div>

        {/* ── 닉네임 변경 내역 ── */}
        {data && (
          <div className="prof-section" style={styles.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div className="prof-section-title" style={{ ...styles.sectionTitle, marginBottom: 0 }}>✏️ 닉네임 변경 내역</div>
              {data.nicknameHistory.length > 3 && (
                <button
                  onClick={() => setShowNickHistory(true)}
                  style={{
                    fontSize: 12, color: "#64748b",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  더보기 ({data.nicknameHistory.length}회) ▾
                </button>
              )}
            </div>
            {data.nicknameHistory.length === 0 ? (
              <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: "16px 0" }}>닉네임 변경 내역이 없어요.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.nicknameHistory.slice(0, 3).map(h => (
                  <div key={h.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 10, gap: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{h.oldNickname || "—"}</span>
                      <span style={{ fontSize: 12, color: "#475569" }}>→</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{h.newNickname}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>
                      {new Date(h.changedAt).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="footer">
          <img src={heroImage} alt="초능력자" className="footer-img" />
          <p className="footer-name">초능력자</p>
          <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
          <p className="footer-sub">This Website and the Chatbot '초능력자' were created and are maintained by 혁도동.</p>
          <div className="footer-links">
            <a href="https://chosung.app/policy" className="footer-policy-link">개인정보처리방침</a>
            <a href="https://chosung.app/balance" className="footer-policy-link">밸런싱 리포트</a>
            <a href="https://open.kakao.com/o/pqOPQEsi" target="_blank" rel="noopener noreferrer" className="footer-policy-link">문의</a>
            <a href="/donate" className="footer-policy-link" style={{ color: "#c4b5fd" }}>💜 후원</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ── 스타일 ─────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#070710",
    color: "#e2e8f0",
    fontFamily: "'Noto Sans KR', sans-serif",
    WebkitFontSmoothing: "antialiased",
  },
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    height: 56,
    background: "rgba(7,7,16,0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  navLogo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  },
  navLogoText: {
    fontWeight: 900,
    fontSize: 16,
    color: "#e2e8f0",
    flexShrink: 0,
  },
  navTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: "#e2e8f0",
    letterSpacing: "0.04em",
  },
  content: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "24px 16px 48px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  loadWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: 16,
  },
  loadSpinner: {
    width: 44,
    height: 44,
    border: "3px solid rgba(3,105,161,0.2)",
    borderTop: "3px solid #0369A1",
    borderRadius: "50%",
    animation: "prof-spin 0.9s linear infinite",
  },
  loadText: {
    color: "#94a3b8",
    fontSize: 15,
  },
  backBtn: {
    marginTop: 12,
    padding: "10px 24px",
    background: "rgba(3,105,161,0.2)",
    border: "1px solid rgba(3,105,161,0.4)",
    borderRadius: 12,
    color: "#38BDF8",
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit",
  },
  // 초능력자 지표 카드
  superpowerCard: {
    display: "flex",
    alignItems: "stretch",
    background: "linear-gradient(135deg, rgba(3,105,161,0.12) 0%, rgba(6,182,212,0.08) 100%)",
    border: "1px solid rgba(3,105,161,0.2)",
    borderRadius: 16,
    overflow: "hidden",
  },
  superpowerItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "16px 8px",
    gap: 4,
    textDecoration: "none",
    color: "inherit",
  },
  superpowerIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  superpowerVal: {
    fontSize: 18,
    fontWeight: 900,
    color: "#e2e8f0",
    letterSpacing: "-0.01em",
  },
  superpowerLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 500,
  },
  superpowerDivider: {
    width: 1,
    background: "rgba(255,255,255,0.07)",
    alignSelf: "stretch",
  },
  // Hero card
  heroCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "nowrap" as const,
    gap: 20,
    background: "linear-gradient(135deg, rgba(3,105,161,0.18) 0%, rgba(6,182,212,0.1) 100%)",
    border: "1px solid rgba(3,105,161,0.25)",
    borderRadius: 20,
    padding: "24px 28px",
  },
  heroLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0369A1, #4f46e5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    fontWeight: 900,
    color: "white",
    flexShrink: 0,
    boxShadow: "0 4px 20px rgba(3,105,161,0.4)",
  },
  heroNick: {
    fontSize: 22,
    fontWeight: 900,
    color: "#f1f5f9",
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 13,
    color: "#0EA5E9",
    fontWeight: 500,
    marginBottom: 8,
  },
  heroBadges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
  },
  badge: {
    fontSize: 12,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 20,
  },
  heroRight: {
    textAlign: "right" as const,
    flexShrink: 0,
  },
  heroScore: {
    fontSize: 36,
    fontWeight: 900,
    color: "#f1f5f9",
    lineHeight: 1,
    marginBottom: 6,
  },
  heroScoreUnit: {
    fontSize: 18,
    color: "#0EA5E9",
    marginLeft: 4,
  },
  heroRankRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  rankEmoji: { fontSize: 18 },
  heroRank: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: 600,
  },
  heroTopPct: {
    fontSize: 13,
    color: "#0369A1",
    fontWeight: 700,
    textAlign: "right" as const,
    background: "rgba(3,105,161,0.15)",
    borderRadius: 8,
    padding: "2px 10px",
    display: "inline-block",
  },
  // Stats
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  },
  battleRow: {
    display: "flex",
    flexDirection: "row" as const,
    gap: 16,
    alignItems: "flex-start",
  },
  battleStatCard: {
    minWidth: 220,
    flexShrink: 0,
  },
  battleHistoryPanel: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "20px 20px 16px",
    minWidth: 0,
  },
  showMoreBtn: {
    marginTop: 12,
    width: "100%",
    padding: "8px 0",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 8,
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center" as const,
    transition: "background 0.15s",
  },
  statCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "20px 20px 16px",
  },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statLabel: {
    fontWeight: 700,
    fontSize: 15,
    color: "#e2e8f0",
    marginBottom: 12,
  },
  statRows: { display: "flex", flexDirection: "column" as const, gap: 8 },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statKey: { fontSize: 13, color: "#64748b" },
  statVal: { fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  accuracyBar: {
    marginTop: 12,
    height: 4,
    background: "rgba(255,255,255,0.08)",
    borderRadius: 4,
    overflow: "hidden",
  },
  accuracyFill: {
    height: "100%",
    background: "linear-gradient(90deg, #0369A1, #0EA5E9)",
    borderRadius: 4,
    transition: "width 0.8s cubic-bezier(.22,1,.36,1)",
  },
  // Effect card
  effectCard: {
    background: "rgba(3,105,161,0.08)",
    border: "1px solid rgba(3,105,161,0.2)",
    borderRadius: 16,
    padding: "20px 20px 16px",
  },
  effectGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  effectItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  effectIcon: { fontSize: 16 },
  effectLabel: { flex: 1, fontSize: 12, color: "#94a3b8" },
  effectVal: { fontSize: 13, fontWeight: 700, color: "#38BDF8" },
  // Section
  section: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "20px",
  },
  sectionTitle: {
    fontWeight: 700,
    fontSize: 16,
    color: "#e2e8f0",
    marginBottom: 14,
  },
  // Tabs
  tabRow: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap" as const,
  },
  tab: {
    padding: "7px 16px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  tabActive: {
    background: "rgba(3,105,161,0.25)",
    border: "1px solid rgba(3,105,161,0.5)",
    color: "#38BDF8",
  },
  emptyBox: {
    textAlign: "center" as const,
    color: "#475569",
    fontSize: 14,
    padding: "32px 0",
  },
  // Relic cards
  relicSingle: {
    display: "flex",
    justifyContent: "flex-start",
  },
  relicGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 12,
  },
  relicCard: {
    borderRadius: 14,
    padding: "16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
    position: "relative" as const,
    minWidth: 0,
  },
  relicBadge: {
    position: "absolute" as const,
    top: -8,
    right: 12,
    fontSize: 11,
    fontWeight: 700,
    color: "white",
    padding: "2px 10px",
    borderRadius: 20,
  },
  relicImgWrap: {
    width: 64,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  relicImg: { width: 60, height: 60, objectFit: "contain" as const, imageRendering: "crisp-edges" as const },
  relicInfo: { display: "flex", flexDirection: "column" as const, gap: 3 },
  relicGrade: { fontSize: 12, fontWeight: 600 },
  relicName: { fontSize: 14, fontWeight: 700, color: "#e2e8f0" },
  relicType: { fontSize: 12, color: "#64748b" },
  relicStats: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 4 },
  relicStat: {
    fontSize: 12,
    padding: "2px 8px",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 6,
    color: "#94a3b8",
    fontWeight: 600,
  },
  // Catalog
  catalogGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  catalogCard: {
    borderRadius: 14,
    padding: "14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    transition: "border-color 0.2s",
  },
  catalogImgWrap: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogImg: { width: 44, height: 44, objectFit: "contain" as const },
  catalogLockWrap: { width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" },
  catalogLock: { fontSize: 28, opacity: 0.5 },
  catalogBody: { display: "flex", flexDirection: "column" as const, gap: 4 },
  catalogName: { fontWeight: 700, fontSize: 14 },
  catalogBestGrade: { fontSize: 11, color: "#94a3b8" },
  catalogDesc: { fontSize: 12, color: "#64748b", lineHeight: 1.4 },
  catalogEffect: { fontSize: 12, fontWeight: 700, marginTop: 2 },
  catalogUnowned: { fontSize: 12, color: "#475569", fontStyle: "italic" as const },
  // Attendance
  attMeta: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 14,
  },
  calWrap: {
    background: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    overflow: "hidden",
  },
  calHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  calNav: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#94a3b8",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 18,
    padding: "2px 12px",
    lineHeight: 1.4,
  },
  calTitle: {
    fontWeight: 700,
    fontSize: 15,
    color: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  calCount: {
    fontSize: 12,
    color: "#0EA5E9",
    fontWeight: 500,
    background: "rgba(3,105,161,0.15)",
    padding: "2px 10px",
    borderRadius: 20,
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
    padding: "8px",
  },
  calDow: {
    textAlign: "center" as const,
    fontSize: 11,
    color: "#475569",
    fontWeight: 700,
    padding: "4px 0",
  },
  calCell: {
    borderRadius: 8,
    padding: "4px 2px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  calDay: { fontSize: 13, fontWeight: 600, lineHeight: 1 },
  calDot: { fontSize: 10, color: "#38BDF8" },
  calNavRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calMonthsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  calMonthCol: {
    minWidth: 0,
  },
  heroRelicRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  heroRelicImg: {
    width: 22,
    height: 22,
    objectFit: "contain" as const,
    imageRendering: "crisp-edges" as const,
  },
  heroRelicMeta: {
    fontSize: 11,
    color: "#64748b",
  },
};
