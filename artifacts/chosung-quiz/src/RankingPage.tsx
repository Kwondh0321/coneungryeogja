import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import heroImage from "/chosung-hero3-nobg.png";
import { useOgMeta } from "./hooks/use-og-meta";
import PatchNoticeModal from "./components/PatchNoticeModal";

type Tab = "superpower" | "point" | "asset" | "battle";

type PointEntry = {
  rank: number; userId: string; nickname: string; score: number;
};
type SuperpowerEntry = {
  rank: number; userId: string; nickname: string;
  superpowerScore: number; pointScore: number;
  relicAssetScore: number; battlePowerBonus: number;
  totalPower: number; mainPower: number; storagePowerApplied: number;
};
type AssetEntry = {
  rank: number; userId: string; nickname: string;
  relicAssetScore: number; relicCount: number; topRelicGrade: number;
};
type BattleEntry = {
  rank: number; userId: string; nickname: string;
  totalPower: number; mainPower: number; storagePowerApplied: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];
const PAGE_SIZE = 20;

function fmt(n: number) { return n.toLocaleString("ko-KR"); }
function fmtPower(n: number) { return n.toFixed(2); }

const BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

function useFetch<T>(url: string, eager = true) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(eager);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = () => {
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then((d: { ranking?: T; updatedAt?: string }) => {
        if (d?.ranking) setData(d.ranking as T);
        if (d?.updatedAt) setUpdatedAt(d.updatedAt);
        loaded.current = true;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (eager) load(); }, []);
  return { data, loading, updatedAt, reload: load, loaded };
}

function usePointRanking()                     { return useFetch<PointEntry[]>(`${BASE}/kakao/full-ranking`); }
function useSuperpowerRanking()                { return useFetch<SuperpowerEntry[]>(`${BASE}/kakao/superpower-ranking`); }
function useAssetRanking(eager = false)        { return useFetch<AssetEntry[]>(`${BASE}/kakao/relic-asset-ranking`, eager); }
function useBattleRanking()                    { return useFetch<BattleEntry[]>(`${BASE}/kakao/relic-ranking`, false); }

type AnyEntry = { rank: number; userId: string; nickname: string };

type MyRankBannerProps = {
  uid: string;
  superpowerData: PointEntry[] | SuperpowerEntry[] | AnyEntry[] | null;
  pointData: PointEntry[] | AnyEntry[] | null;
  assetData: AssetEntry[] | AnyEntry[] | null;
  superpowerLoading: boolean;
  pointLoading: boolean;
  assetLoading: boolean;
  activeTab: Tab;
  onTabClick: (tab: Tab) => void;
};

function MyRankBanner({
  uid, superpowerData, pointData, assetData,
  superpowerLoading, pointLoading, assetLoading,
  activeTab, onTabClick,
}: MyRankBannerProps) {
  const spEntry   = (superpowerData as AnyEntry[] | null)?.find(e => e.userId === uid);
  const ptEntry   = (pointData      as AnyEntry[] | null)?.find(e => e.userId === uid);
  const asEntry   = (assetData      as AnyEntry[] | null)?.find(e => e.userId === uid);

  const nickname = spEntry?.nickname ?? ptEntry?.nickname ?? asEntry?.nickname;

  const items: { tab: Tab; label: string; rank: number | null; loading: boolean }[] = [
    { tab: "superpower", label: "🌟 초능력자",  rank: spEntry?.rank ?? null, loading: superpowerLoading },
    { tab: "point",      label: "💎 포인트",     rank: ptEntry?.rank ?? null, loading: pointLoading },
    { tab: "asset",      label: "🏺 유물자산",  rank: asEntry?.rank ?? null, loading: assetLoading },
  ];

  return (
    <div className="my-rank-banner">
      <div className="my-rank-banner-header">
        <span className="my-rank-banner-icon">👤</span>
        <span className="my-rank-banner-title">
          {nickname ? <><strong>{nickname}</strong>님의 내 순위</> : "내 순위"}
        </span>
      </div>
      <div className="my-rank-banner-items">
        {items.map(({ tab, label, rank, loading }) => (
          <button
            key={tab}
            className={`my-rank-badge${activeTab === tab ? " my-rank-badge-active" : ""}`}
            onClick={() => onTabClick(tab)}
          >
            <span className="my-rank-badge-label">{label}</span>
            <span className="my-rank-badge-rank">
              {loading
                ? <span className="my-rank-badge-loading">…</span>
                : rank !== null
                  ? <><strong>{rank}</strong>위</>
                  : <span className="my-rank-badge-none">순위 없음</span>
              }
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function getValue(entry: AnyEntry, tab: Tab): string {
  if (tab === "point")      return `${fmt((entry as PointEntry).score)} P`;
  if (tab === "superpower") return `${fmt((entry as SuperpowerEntry).superpowerScore)} 점`;
  if (tab === "asset")      return `${fmt((entry as AssetEntry).relicAssetScore)} P`;
  if (tab === "battle")     return `${fmtPower((entry as BattleEntry).totalPower)}`;
  return "";
}

function getSub(entry: AnyEntry, tab: Tab, spScoreMap?: Map<string, number>): React.ReactNode | null {
  if (tab === "superpower") {
    const e = entry as SuperpowerEntry;
    return (
      <>
        포인트 {fmt(e.pointScore)}P
        <br className="rank-sub-br" />
        {" · "}유물자산 {fmt(e.relicAssetScore)}P · 전투력+{fmt(e.battlePowerBonus)}
      </>
    );
  }
  if (tab === "point" && spScoreMap) {
    const sp = spScoreMap.get(entry.userId);
    return sp !== undefined ? `점수 : ${fmt(sp)}점` : null;
  }
  if (tab === "asset") {
    const e = entry as AssetEntry;
    const GRADE: Record<number, string> = { 1: "D", 2: "C", 3: "B", 4: "A", 5: "S", 6: "SS" };
    return `유물 ${e.relicCount}개 · 최고등급 ${GRADE[e.topRelicGrade] ?? "??"}`;
  }
  if (tab === "battle") {
    const e = entry as BattleEntry;
    return `메인 ${fmtPower(e.mainPower)} · 보관 ${fmtPower(e.storagePowerApplied)}`;
  }
  return null;
}

function RankRow({ entry, tab, highlight, profileHref, spScoreMap }: {
  entry: AnyEntry; tab: Tab; highlight?: boolean; profileHref: string;
  spScoreMap?: Map<string, number>;
}) {
  const isTop3 = entry.rank <= 3;
  const rowRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (highlight && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  const sub = getSub(entry, tab, spScoreMap);
  return (
    <a
      ref={rowRef}
      href={profileHref}
      className={`rank-row-item${highlight ? " rank-row-highlight" : ""}${isTop3 ? " rank-row-top" : ""}`}
      data-rank={entry.rank}
      style={{ textDecoration: "none", cursor: "pointer" }}
    >
      <span className="rank-pos">
        {isTop3 ? MEDALS[entry.rank - 1] : <span className="rank-num">{entry.rank}</span>}
      </span>
      <span className="rank-body">
        <span className="rank-top-line">
          <span className="rank-nick">{entry.nickname}</span>
          <span className="rank-score">{getValue(entry, tab)}</span>
        </span>
        {sub && <span className="rank-sub-line">{sub}</span>}
      </span>
    </a>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  superpower: "🌟 초능력자",
  point:      "💎 보유포인트",
  asset:      "🏺 유물자산",
  battle:     "⚔️ 전투력",
};

const TAB_DESC: Record<Tab, React.ReactNode> = {
  superpower: (
    <>
      포인트 + 유물자산가치 + 전투력 보너스를 합산한 종합 초능력 순위
      <br />
      <span style={{ fontSize: "12px", opacity: 0.65 }}>
        종합점수 = 보유포인트 + 유물자산 + round(K × log10(1 + 전투력))
      </span>
    </>
  ),
  point:  "현재 보유 포인트(P) 기준 순위",
  asset:  "유물 획득·강화·레벨업·합성에 투자한 누적 자산가치 기준 순위",
  battle: (
    <>
      메인 유물 100% + 보관함 유물 스택 적용 실효 전투력 기준 순위
      <br />
      <span style={{ fontSize: "12px", opacity: 0.65 }}>
        실효 전투력 = 메인전투력 + Σ보관유물전투력×39% (타입별 스택 제한)
      </span>
    </>
  ),
};

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("superpower");
  const [search, setSearch]       = useState("");

  const params    = new URLSearchParams(window.location.search);
  const targetUid = params.get("uid") ?? "";

  const pointData      = usePointRanking();
  const superpowerData = useSuperpowerRanking();
  const assetData      = useAssetRanking(!!targetUid);
  const battleData     = useBattleRanking();

  const initPage  = (() => { const p = parseInt(params.get("page") ?? "1", 10); return Number.isFinite(p) && p >= 1 ? p : 1; })();
  const [page, setPage] = useState(initPage);

  const isRankDomain = window.location.hostname === "rank.chosung.app";
  useOgMeta({
    title: "초능력자 랭킹 — 전체 순위 확인",
    description: "초능력자 카카오톡 챗봇 서버 전체 순위. 초능력자 점수·포인트·유물 자산·배틀 전적 기준 랭킹.",
    url: isRankDomain ? "https://rank.chosung.app" : "https://chosung.app/ranking",
  });

  const activeRawData =
    activeTab === "point"      ? pointData.data :
    activeTab === "superpower" ? superpowerData.data :
    activeTab === "asset"      ? assetData.data :
    battleData.data;

  const activeRanking: AnyEntry[] = (activeRawData as AnyEntry[] | null) ?? [];

  const activeLoading =
    activeTab === "point"      ? pointData.loading :
    activeTab === "superpower" ? superpowerData.loading :
    activeTab === "asset"      ? assetData.loading :
    battleData.loading;

  const activeUpdatedAt =
    activeTab === "point"      ? pointData.updatedAt :
    activeTab === "superpower" ? superpowerData.updatedAt :
    activeTab === "asset"      ? assetData.updatedAt :
    battleData.updatedAt;

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearch("");
    setPage(1);
    if (tab === "asset"  && !assetData.loaded.current)  assetData.reload();
    if (tab === "battle" && !battleData.loaded.current) battleData.reload();
  };

  const handleReload = () => {
    if (activeTab === "point")      pointData.reload();
    if (activeTab === "superpower") superpowerData.reload();
    if (activeTab === "asset")      assetData.reload();
    if (activeTab === "battle")     battleData.reload();
    setPage(1);
    setSearch("");
  };

  useEffect(() => {
    if (!targetUid || activeRanking.length === 0) return;
    const entry = activeRanking.find(e => e.userId === targetUid);
    if (entry) setPage(Math.ceil(entry.rank / PAGE_SIZE));
  }, [activeRanking, targetUid]);

  useEffect(() => {
    const title   = "초능력자 랭킹";
    const desc    = "카카오톡 챗봇 초능력자의 포인트 랭킹을 볼 수 있어요!";
    const defTitle = "초능력자 - 카카오톡 챗봇";
    const defDesc  = "1인 개발 챗봇 프로젝트입니다! 모든 이용자 분께 감사의 인사를 드립니다";
    const set = (t: string, d: string) => {
      document.title = t;
      document.querySelector('meta[name="description"]')?.setAttribute("content", d);
      document.querySelector('meta[property="og:title"]')?.setAttribute("content", t);
      document.querySelector('meta[property="og:description"]')?.setAttribute("content", d);
    };
    set(title, desc);
    return () => set(defTitle, defDesc);
  }, []);

  const homeHref = isRankDomain
    ? "https://chosung.app"
    : (() => { const base = (import.meta.env.BASE_URL as string) ?? "/"; return base.endsWith("/") ? base : base + "/"; })();

  const timeStr = activeUpdatedAt
    ? new Date(activeUpdatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const trimmed = search.trim();

  const filtered = useMemo(() => {
    if (!trimmed) return null;
    return activeRanking.filter(e => e.nickname.toLowerCase().includes(trimmed.toLowerCase()));
  }, [activeRanking, trimmed]);

  const totalPages = Math.ceil(activeRanking.length / PAGE_SIZE);
  const paged = useMemo(() => {
    if (filtered) return null;
    const start = (page - 1) * PAGE_SIZE;
    return activeRanking.slice(start, start + PAGE_SIZE);
  }, [activeRanking, page, filtered]);

  const displayList = filtered ?? paged ?? [];

  const spScoreMap = useMemo(() => {
    if (!superpowerData.data) return undefined;
    return new Map((superpowerData.data as SuperpowerEntry[]).map(e => [e.userId, e.superpowerScore]));
  }, [superpowerData.data]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const goPage = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const buildProfileHref = (userId: string) =>
    isRankDomain
      ? `https://chosung.app/profile?uid=${encodeURIComponent(userId)}`
      : `/profile?uid=${encodeURIComponent(userId)}`;

  const renderPagination = (key: string) => (
    <div className="ranking-pagination">
      <button className="page-btn" disabled={page === 1} onClick={() => goPage(1)}>처음</button>
      <button className="page-btn" disabled={page === 1} onClick={() => goPage(page - 1)}>‹ 이전</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
        .reduce<(number | "…")[]>((acc, p, i, arr) => {
          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
          acc.push(p);
          return acc;
        }, [])
        .map((p, i) =>
          p === "…" ? (
            <span key={`${key}-ellipsis-${i}`} className="page-ellipsis">…</span>
          ) : (
            <button
              key={`${key}-${p}`}
              className={`page-btn${p === page ? " page-btn-active" : ""}`}
              onClick={() => goPage(p as number)}
            >{p}</button>
          )
        )}
      <button className="page-btn" disabled={page === totalPages} onClick={() => goPage(page + 1)}>다음 ›</button>
      <button className="page-btn" disabled={page === totalPages} onClick={() => goPage(totalPages)}>마지막</button>
    </div>
  );

  return (
    <div className="ranking-page" style={{ background: "#070710", color: "#e2e8f0" }}>
      <PatchNoticeModal />
      <nav className="nav">
        <a className="nav-logo" href={homeHref} style={{ textDecoration: "none" }}>
          <img src={heroImage} alt="" />
          <span>초능력자</span>
        </a>
        <div className="nav-links">
          <a
            href={homeHref}
            style={{
              fontSize: 12, color: "#94a3b8", background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20,
              padding: "4px 14px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            🏠 홈
          </a>
          <a
            href={isRankDomain ? "https://chosung.app/donate" : "/donate"}
            style={{
              fontSize: 12, color: "#c4b5fd", background: "rgba(167,139,250,0.12)",
              border: "1px solid rgba(167,139,250,0.3)", borderRadius: 20,
              padding: "4px 14px", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            💜 후원
          </a>
        </div>
      </nav>

      <main className="ranking-main">
        <div className="ranking-hero">
          <div className="eyebrow">실시간 리더보드</div>
          <h1 className="ranking-title">서버 전체 랭킹</h1>
          <p className="ranking-sub">{TAB_DESC[activeTab]}</p>
        </div>

        <div className="ranking-tabs">
          {(["superpower", "point", "asset", "battle"] as Tab[]).map(tab => (
            <button
              key={tab}
              className={`ranking-tab-btn${activeTab === tab ? " ranking-tab-active" : ""}`}
              onClick={() => handleTabChange(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {targetUid && (
          <MyRankBanner
            uid={targetUid}
            superpowerData={superpowerData.data}
            pointData={pointData.data}
            assetData={assetData.data}
            superpowerLoading={superpowerData.loading}
            pointLoading={pointData.loading}
            assetLoading={assetData.loading}
            activeTab={activeTab}
            onTabClick={handleTabChange}
          />
        )}

        <div className="ranking-container">
          <div className="ranking-toolbar">
            <span className="ranking-count">
              {activeLoading ? "불러오는 중…" : `총 ${activeRanking.length}명`}
            </span>
            {timeStr && <span className="ranking-time">기준: {timeStr}</span>}
            <button className="ranking-refresh-btn" onClick={handleReload} disabled={activeLoading}>
              {activeLoading ? "⏳" : "🔄 새로고침"}
            </button>
          </div>

          {!activeLoading && activeRanking.length > 0 && (
            <div className="ranking-search-wrap">
              <input
                className="ranking-search-input"
                type="text"
                placeholder="닉네임 검색…"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                autoComplete="off"
              />
              {trimmed && (
                <button className="ranking-search-clear" onClick={() => handleSearch("")} aria-label="검색 지우기">✕</button>
              )}
            </div>
          )}

          {trimmed && filtered && (
            <div className="ranking-search-result-info">
              {filtered.length === 0
                ? `"${trimmed}"에 해당하는 닉네임이 없어요`
                : `"${trimmed}" 검색 결과 ${filtered.length}명`}
            </div>
          )}

          {activeLoading ? (
            <div className="ranking-loading">
              <div className="loading-spinner" />
              <p>랭킹을 불러오는 중이에요…</p>
            </div>
          ) : activeRanking.length === 0 ? (
            <div className="ranking-empty">
              <div style={{ fontSize: "3rem" }}>🌟</div>
              <p>아직 기록이 없어요.<br />첫 번째 능력자가 되어보세요!</p>
            </div>
          ) : (
            <>
              {!filtered && totalPages > 1 && renderPagination("top")}
              <div className="ranking-list">
                {displayList.map(entry => (
                  <RankRow
                    key={`${activeTab}-${entry.rank}`}
                    entry={entry}
                    tab={activeTab}
                    highlight={targetUid ? entry.userId === targetUid : !!trimmed}
                    profileHref={buildProfileHref(entry.userId)}
                    spScoreMap={spScoreMap}
                  />
                ))}
                {filtered && filtered.length === 0 && (
                  <div className="ranking-empty" style={{ padding: "2rem" }}>
                    <div style={{ fontSize: "2rem" }}>🔍</div>
                    <p>일치하는 닉네임이 없어요</p>
                  </div>
                )}
              </div>
              {!filtered && totalPages > 1 && renderPagination("bottom")}
              {!filtered && (
                <div className="ranking-page-info">
                  {page} / {totalPages} 페이지 &nbsp;·&nbsp;
                  {(page - 1) * PAGE_SIZE + 1}~{Math.min(page * PAGE_SIZE, activeRanking.length)}위 표시 중
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <img src={heroImage} alt="초능력자" className="footer-img" />
        <p className="footer-name">초능력자</p>
        <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
        <p className="footer-sub">This Website and the Chatbot '초능력자' were created and are maintained by 혁도동.</p>
        <div className="footer-links">
          {isRankDomain
            ? <a href="https://chosung.app/policy" className="footer-policy-link">개인정보처리방침</a>
            : <Link to="/policy" className="footer-policy-link">개인정보처리방침</Link>
          }
          <a href="https://chosung.app/balance" className="footer-policy-link">밸런싱 리포트</a>
          <a href="https://open.kakao.com/o/pqOPQEsi" target="_blank" rel="noopener noreferrer" className="footer-policy-link">문의</a>
          <a href={isRankDomain ? "https://chosung.app/donate" : "/donate"} className="footer-policy-link" style={{ color: "#c4b5fd" }}>💜 후원</a>
        </div>
      </footer>
    </div>
  );
}
