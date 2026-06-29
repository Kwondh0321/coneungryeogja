import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from "react-router-dom";

import RankingPage from "./RankingPage";
import LegalPage from "./LegalPage";
import ContactPage from "./ContactPage";
import PatchNotesPage from "./PatchNotesPage";
import DetailPage from "./DetailPage";
import ProfilePage from "./ProfilePage";
import BalancePage from "./BalancePage";
import DonatePage from "./DonatePage";
import heroImage from "/chosung-hero3-nobg.png";

/* ── Ads ── */
declare global { interface Window { adsbygoogle: unknown[] } }
function MobileStickyAd() {
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, []);
  return (
    <div className="sticky-ad-wrap">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client="ca-pub-8058432315975159"
        data-ad-slot="8858203842"
      />
    </div>
  );
}
function SidebarAd({ side }: { side: "left" | "right" }) {
  const insRef = useRef<HTMLModElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }, []);
  useEffect(() => {
    const el = insRef.current;
    if (!el) return;
    const check = () => {
      if (el.getAttribute("data-ad-status") === "filled") {
        setFilled(true);
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    check();
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`sidebar-ad sidebar-ad-${side}`} style={{ opacity: filled ? 1 : 0, transition: "opacity 0.3s" }}>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-8058432315975159"
        data-ad-slot="2679897594"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
function AdLayout() {
  const location = useLocation();
  if (location.pathname === "/donate") return null;
  return (
    <>
      <MobileStickyAd />
      <SidebarAd side="left" />
      <SidebarAd side="right" />
    </>
  );
}

/* ── Scroll-reveal hook ── */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Scroll Down Button ── */
function ScrollDownBtn({ target }: { target: string }) {
  return (
    <div className="scroll-down-wrap">
      <button
        className="scroll-cue-btn scroll-cue-icon-only"
        onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth" })}
        aria-label="아래로 스크롤"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3.5 8.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/* ── Floating letters ── */
const LETTERS = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅊ","ㅎ"];
function FloatLetters() {
  return (
    <div className="float-layer" aria-hidden="true">
      {LETTERS.map((l, i) => (
        <span
          key={i}
          className="float-letter"
          style={{
            left: `${(i / LETTERS.length) * 100 + Math.sin(i) * 4}%`,
            animationDuration: `${16 + (i % 5) * 3}s`,
            animationDelay: `${i * 1.8}s`,
            fontSize: `${22 + (i % 4) * 10}px`,
            opacity: 0.025 + (i % 3) * 0.015,
          }}
        >{l}</span>
      ))}
    </div>
  );
}

/* ── Nav ── */
function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="nav-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
        <img src={heroImage} alt="" />
        <span>초능력자</span>
      </div>
      <div className="nav-links">
        <button className="nav-donate-btn" onClick={() => navigate("/donate")}>☕ 후원</button>
      </div>
    </nav>
  );
}

/* ── Hero ── */
function Hero() {
  const scroll = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <section className="hero" id="hero">
      <FloatLetters />
      <div className="hero-inner reveal">
        <div className="hero-badge">카카오톡 퀴즈 봇</div>
        <h1 className="hero-title"><span className="grad-text">초능력자</span></h1>
        <div className="hero-mascot">
          <img src={heroImage} alt="초능력자 마스코트" />
        </div>
        <p className="hero-desc">
          채팅방에서 친구들과 즐기는<br />
          <strong>초성 퀴즈 · 훈민정음 · 자모연성</strong>
        </p>
        <div className="hero-nav-pills">
          <button className="hero-nav-pill" onClick={() => scroll("stats")}>📊 실시간현황</button>
          <button className="hero-nav-pill" onClick={() => scroll("modes")}>🎮 게임 소개</button>
          <button className="hero-nav-pill" onClick={() => scroll("ranking-section")}>🏆 랭킹</button>
          <button className="hero-nav-pill" onClick={() => scroll("commands")}>📋 명령어</button>
        </div>
      </div>
      <div className="hero-invite-wrap reveal">
        <a
          href="https://pf.kakao.com/_xdRzjX/chatbot/invite?referer=promotion"
          target="_blank"
          rel="noopener noreferrer"
          className="kakao-invite-btn"
        >
          <span className="kakao-invite-icon">Ch+</span>
          <span className="kakao-invite-text">채팅방에 초능력자 추가하기</span>
        </a>
      </div>
      <ScrollDownBtn target="stats" />
    </section>
  );
}

/* ── Count-up animation hook ── */
function useCountUp(target: number | undefined, duration = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === undefined) return;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setValue(Math.round(from + (target - from) * ease));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return value;
}

/* ── Public Stats section ── */
function StatCard({ icon, label, value, suffix = "", wide = false }: {
  icon: string; label: string; value: number | undefined; suffix?: string; wide?: boolean;
}) {
  const displayed = useCountUp(value);
  return (
    <div className={`stat-card reveal${wide ? " stat-card-wide" : ""}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-number">
        {value === undefined ? "-" : displayed.toLocaleString("ko-KR") + suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

type PublicStats = { userCount: number; quizCount: number; totalAnswers: number; totalCorrect: number; totalScore: number; totalVisits: number; todayVisits: number; todayActiveUsers: number };

function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | undefined>(undefined);
  useEffect(() => {
    const base: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
    fetch(`${base}/stats/public`)
      .then((r) => r.json())
      .then((d: PublicStats) => setStats(d))
      .catch(() => {});
  }, []);
  return stats;
}

function StatsSection() {
  const stats = usePublicStats();
  return (
    <section className="section stats-section" id="stats">
      <div className="container">
        <div className="eyebrow reveal">실시간 현황</div>
        <h2 className="section-h reveal">초능력자 지금까지</h2>
        <div className="stats-grid">
          <StatCard icon="👤" label="총 유저 수"          value={stats?.userCount}        suffix="명" />
          <StatCard icon="✅" label="누적 정답 수"        value={stats?.totalCorrect}     suffix="회" />
          <StatCard icon="🔥" label="오늘 활동한 유저 수" value={stats?.todayActiveUsers} suffix="명" />
          <StatCard icon="💜" label="총 포인트 유통량"   value={stats?.totalScore}       suffix="P" wide />
          <StatCard icon="🌐" label="총 사이트 방문 수"  value={stats?.totalVisits}      suffix="회" />
        </div>
      </div>
      <ScrollDownBtn target="modes" />
    </section>
  );
}

/* ── Ranking fetch hook ── */
type RankEntry = { rank: number; nickname: string; score: number };
type SpRankEntry = { rank: number; nickname: string; superpowerScore: number };
const MEDALS_WEB = ["🥇", "🥈", "🥉"];
function fmt(n: number) { return n.toLocaleString("ko-KR"); }

function useServerRanking() {
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  useEffect(() => {
    const base: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
    fetch(`${base}/kakao/server-ranking`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.ranking)) setRanking(d.ranking.slice(0, 3)); })
      .catch(() => {});
  }, []);
  return ranking;
}

function useSuperpowerRankingPreview() {
  const [ranking, setRanking] = useState<SpRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const base: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
    fetch(`${base}/kakao/superpower-ranking`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.ranking)) setRanking(d.ranking.slice(0, 4)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  return { ranking, loading };
}

/* ── Game Modes (5-card bento) ── */
function BentoNextBtn({ target }: { target: string }) {
  return (
    <button
      className="bento-next-btn"
      onClick={e => { e.stopPropagation(); document.getElementById(target)?.scrollIntoView({ behavior: "smooth" }); }}
      aria-label="다음 카드"
    >
      ↓
    </button>
  );
}

function Modes() {
  const serverRanking = useServerRanking();
  const navigate = useNavigate();
  return (
    <section className="section" id="modes">
      <div className="container">
        <div className="eyebrow reveal">기능 소개</div>
        <h2 className="section-h reveal">주요 기능</h2>

        <div className="bento-grid">
          {/* 1. 초성퀴즈 */}
          <div id="bento-chosung" className="bento-card card-orange reveal" onClick={() => navigate("/detail/chosung")} role="button" tabIndex={0}>
            <div className="card-top">
              <span className="card-icon">⚡</span>
              <span className="card-tag">단일 정답</span>
            </div>
            <h3 className="card-h">초성퀴즈</h3>
            <p className="card-kicker">가장 먼저 맞춘 사람이 승리!</p>
            <p className="card-body">
              봇이 초성을 공개하면 정답을 가장 빠르게 입력한 사람이 이겨요.
              정답은 <strong>딱 1개</strong>만 인정되고 누구나 바로 참여할 수 있어요.
            </p>
            <div className="steps">
              {["봇이 초성을 공개해요", "채팅창에 빠르게 정답 입력!", "먼저 맞춘 사람이 포인트 획득 🏆"].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-num">{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="demo-box">
              <div className="demo-q">ㄱ ㅊ</div>
              <div className="demo-answers">
                <span className="ans-wrong">김치 ✗</span>
                <span className="ans-right">고체 ✓</span>
              </div>
              <div className="demo-note">정답은 오직 하나 · 먼저가 승리</div>
            </div>
            <code className="cmd-inline">@초능력자 초성퀴즈</code>
            <span className="card-detail-link">자세히 보기 →</span>
            <BentoNextBtn target="bento-jamo" />
          </div>

          {/* 2. 자모연성 */}
          <div id="bento-jamo" className="bento-card card-green reveal" onClick={() => navigate("/detail/jamo")} role="button" tabIndex={0} style={{ animationDelay: "0.08s" }}>
            <div className="card-top">
              <span className="card-icon">🔤</span>
              <span className="card-tag">자모 퍼즐</span>
            </div>
            <h3 className="card-h">자모연성</h3>
            <p className="card-kicker">흩어진 자모로 단어를 맞혀라!</p>
            <p className="card-body">
              한글 자모가 섞여 제시돼요. <strong>4개의 보기</strong> 중 자모로 만들 수 있는
              단어를 선택하세요. 연속으로 맞힐수록 보너스 포인트가 늘어나요!
            </p>
            <div className="steps">
              {[
                "자모 목록과 4개 선택지 공개",
                "자모로 만들 수 있는 단어 선택",
                "연속 정답으로 보너스 쌓기 🎯",
              ].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-num step-green">{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="demo-box demo-box-green">
              <div className="jamo-pool">ㄱ &nbsp;ㅎ &nbsp;ㅓ &nbsp;ㅏ &nbsp;ㅊ &nbsp;ㄴ &nbsp;ㅊ &nbsp;ㄹ</div>
              <div className="jamo-choices">
                <span className="jamo-choice">1. 일상</span>
                <span className="jamo-choice">2. 증명</span>
                <span className="jamo-choice jamo-correct">3. 천착 ✓</span>
                <span className="jamo-choice">4. 친구</span>
              </div>
              <div className="demo-note">보통 난이도 · 기본 2,670P</div>
            </div>
            <code className="cmd-inline cmd-inline-green">@초능력자 자모연성</code>
            <span className="card-detail-link">자세히 보기 →</span>
            <BentoNextBtn target="bento-hunmin" />
          </div>

          {/* 3. 훈민정음 */}
          <div id="bento-hunmin" className="bento-card card-blue reveal" onClick={() => navigate("/detail/hunmin")} role="button" tabIndex={0} style={{ animationDelay: "0.16s" }}>
            <div className="card-top">
              <span className="card-icon">📖</span>
              <span className="card-tag">복수 정답</span>
            </div>
            <h3 className="card-h">훈민정음</h3>
            <p className="card-kicker">많이 맞출수록 유리!</p>
            <p className="card-body">
              제시된 초성으로 가능한 단어를 최대한 많이 입력해요.
              맞는 답이면 <strong>여러 개 전부 인정</strong>돼요.
              참여자 등록 후 참여할 수 있어요.
            </p>
            <div className="steps">
              {["@초능력자 참여 로 먼저 등록", "봇이 초성 공개 → 아는 단어 전부 입력", "제한 시간 내 최다 정답자 승리 🏆"].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-num step-blue">{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="demo-box demo-box-blue">
              <div className="demo-q">ㄱ ㅊ</div>
              <div className="demo-answers">
                <span className="ans-right">김치 ✓</span>
                <span className="ans-right">고체 ✓</span>
                <span className="ans-right">고추 ✓</span>
                <span className="ans-wrong">긔츼 ✗</span>
              </div>
              <div className="demo-note">맞는 단어 모두 정답 · 많을수록 유리</div>
            </div>
            <code className="cmd-inline cmd-inline-blue">@초능력자 훈민정음</code>
            <span className="card-detail-link">자세히 보기 →</span>
            <BentoNextBtn target="bento-relic" />
          </div>

          {/* 4. 유물 시스템 */}
          <div id="bento-relic" className="bento-card card-amber reveal" onClick={() => navigate("/detail/relic")} role="button" tabIndex={0} style={{ animationDelay: "0.24s" }}>
            <div className="card-top">
              <span className="card-icon">🏛️</span>
              <span className="card-tag">수집 · 강화</span>
            </div>
            <h3 className="card-h">유물 시스템</h3>
            <p className="card-kicker">게임 드롭으로 수집, 강화로 더 강하게!</p>
            <p className="card-body">
              게임에서 승리하면 유물이 드롭돼요.
              <strong>D→C→B→A→S</strong> 5등급으로 강화·합성해서
              포인트 보너스 효과를 극대화하세요.
            </p>
            <div className="steps">
              {[
                "게임 승리 시 유물 랜덤 드롭",
                "강화(+20) · 레벨업(50단계)으로 성장",
                "합성으로 D→C→B→A→S→🔴SS 제작",
              ].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-num step-amber">{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="demo-box demo-box-amber">
              <div className="grade-badges">
                <span className="grade-badge grade-d">⚪ D</span>
                <span className="grade-badge grade-c">🟢 C</span>
                <span className="grade-badge grade-b">🔵 B</span>
                <span className="grade-badge grade-a">🟣 A</span>
                <span className="grade-badge grade-s">🟡 S</span>
              </div>
              <div className="demo-note">5단계 등급 · 최대 +20강 · 레벨 30</div>
            </div>
            <code className="cmd-inline cmd-inline-amber">@초능력자 내유물</code>
            <span className="card-detail-link">자세히 보기 →</span>
            <BentoNextBtn target="bento-combo" />
          </div>

          {/* 5. 콤보 시스템 */}
          <div id="bento-combo" className="bento-card card-purple reveal" onClick={() => navigate("/detail/combo")} role="button" tabIndex={0} style={{ animationDelay: "0.32s" }}>
            <div className="card-top">
              <span className="card-icon">🔥</span>
              <span className="card-tag">콤보 보너스</span>
            </div>
            <h3 className="card-h">콤보 시스템</h3>
            <p className="card-kicker">세 게임 중 어디서 이겨도 카운트!</p>
            <p className="card-body">
              초성퀴즈·훈민정음·자모연성 중 <strong>10분 내에 5번 승리</strong>하면
              콤보가 발동해요. <strong>60초간 +20% 포인트 보너스</strong>가 붙어요.
            </p>
            <div className="steps">
              {[
                "10분 안에 어떤 게임이든 5번 승리",
                "5번 승리 달성 → 콤보 발동! 🔥",
                "60초간 모든 포인트 획득 +20% ✨",
              ].map((s, i) => (
                <div key={i} className="step">
                  <div className="step-num step-purple">{i + 1}</div>
                  <span>{s}</span>
                </div>
              ))}
            </div>
            <div className="demo-box demo-box-purple">
              <div className="combo-demo">
                <div className="combo-win-row">
                  <span className="combo-chip orange-chip">⚡ 초성 승리</span>
                  <span className="combo-chip blue-chip">📖 훈민 승리</span>
                  <span className="combo-chip orange-chip">⚡ 초성 승리</span>
                  <span className="combo-chip blue-chip">🔤 자모 승리</span>
                  <span className="combo-chip orange-chip">⚡ 5번째!</span>
                </div>
                <div className="combo-arrow">↓ 5연승 달성!</div>
                <div className="combo-result">🔥 콤보 발동! · 60초간 +20%</div>
              </div>
              <div className="demo-note">세 게임 모두 카운트 · 60초간 지속</div>
            </div>
            <span className="card-detail-link">자세히 보기 →</span>
          </div>

        </div>
      </div>
      <ScrollDownBtn target="ranking-section" />
    </section>
  );
}

/* ── Ranking Section ── */
function RankingSection() {
  const { ranking, loading } = useSuperpowerRankingPreview();
  const navigate = useNavigate();

  return (
    <section className="section ranking-section" id="ranking-section">
      <div className="container">
        <div className="eyebrow reveal">리더보드</div>
        <h2 className="section-h reveal">랭킹 시스템</h2>
        <p className="ranking-sec-sub reveal">초능력자 점수로 서버 정상에 도달하세요!</p>

        <div className="rs-wrap reveal">
          <div className="rs-board">
            <div className="rs-board-header">
              <span>순위</span>
              <span>닉네임</span>
              <span>초능력자 점수</span>
            </div>
            {loading ? (
              <div className="rs-loading">불러오는 중…</div>
            ) : ranking.length === 0 ? (
              <div className="rs-loading">아직 기록이 없어요 🌟</div>
            ) : (
              ranking.map((u) => (
                <div key={u.rank} className={`rs-row${u.rank <= 3 ? " rs-row-top" : ""}`}>
                  <span className="rs-rank">
                    {u.rank <= 3 ? MEDALS_WEB[u.rank - 1] : u.rank}
                  </span>
                  <span className="rs-nick">{u.nickname}</span>
                  <span className="rs-pts">{fmt(u.superpowerScore)}점</span>
                </div>
              ))
            )}
            {ranking.length >= 4 && (
              <button className="rs-more-btn" onClick={() => window.location.href = RANK_URL}>+ 더보기</button>
            )}
          </div>

          <button className="rs-full-btn" onClick={() => window.location.href = RANK_URL}>🏆 전체 랭킹 보기</button>

          <div className="rs-stat-cards">
            <div className="rs-stat">
              <span className="rs-stat-icon">⚡</span>
              <div>
                <p className="rs-stat-label">초성퀴즈</p>
                <p className="rs-stat-val">최대 7,500P</p>
              </div>
            </div>
            <div className="rs-stat">
              <span className="rs-stat-icon">📖</span>
              <div>
                <p className="rs-stat-label">훈민정음</p>
                <p className="rs-stat-val">단어당 2,500P</p>
              </div>
            </div>
            <div className="rs-stat">
              <span className="rs-stat-icon">🏆</span>
              <div>
                <p className="rs-stat-label">MVP 보너스</p>
                <p className="rs-stat-val">+12,000P</p>
              </div>
            </div>
            <div className="rs-stat">
              <span className="rs-stat-icon">📅</span>
              <div>
                <p className="rs-stat-label">출석 보상</p>
                <p className="rs-stat-val">하루 3,000P</p>
              </div>
            </div>
            <div className="rs-stat">
              <span className="rs-stat-icon">🔥</span>
              <div>
                <p className="rs-stat-label">콤보 보너스</p>
                <p className="rs-stat-val">+20% · 60초</p>
              </div>
            </div>
            <div className="rs-stat">
              <span className="rs-stat-icon">🔤</span>
              <div>
                <p className="rs-stat-label">자모연성</p>
                <p className="rs-stat-val">최대 4,000P+</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ScrollDownBtn target="commands" />
    </section>
  );
}

/* ── Commands ── */
function Commands() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateNav = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setTimeout(updateNav, 50);
    el.addEventListener("scroll", updateNav, { passive: true });
    window.addEventListener("resize", updateNav);
    return () => {
      el.removeEventListener("scroll", updateNav);
      window.removeEventListener("resize", updateNav);
    };
  }, []);

  const scroll = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector(".cmd-card") as HTMLElement | null;
    const step = card ? card.getBoundingClientRect().width + 16 : 320;
    el.scrollTo({ left: el.scrollLeft + dir * step, behavior: "smooth" });
  };

  const groups = [
    {
      title: "⚡ 초성퀴즈",
      color: "#D97706",
      cmds: [
        { cmd: "@초능력자 초성퀴즈",  desc: "게임 시작" },
        { cmd: "@초능력자 힌트",      desc: "힌트 (100P)" },
        { cmd: '@초능력자 "키워드"',  desc: "정답 입력" },
        { cmd: "@초능력자 종료",      desc: "게임 종료" },
      ],
    },
    {
      title: "📖 훈민정음",
      color: "#06B6D4",
      cmds: [
        { cmd: "@초능력자 훈민정음",   desc: "게임 시작" },
        { cmd: "@초능력자 참여", desc: "참여자 등록" },
        { cmd: '@초능력자 "키워드"',   desc: "정답 입력" },
      ],
    },
    {
      title: "✨ 기능 / 정보",
      color: "#0EA5E9",
      cmds: [
        { cmd: "@초능력자 도움말",                     desc: "전체 명령어 안내" },
        { cmd: "@초능력자 출첵",                         desc: "출석 보상 (10,000P)" },
        { cmd: "@초능력자 프로필",                       desc: "포인트·기록 정보" },
        { cmd: "@초능력자 랭킹",                         desc: "포인트 랭킹" },
        { cmd: "@초능력자 선물 @닉네임 '포인트수'", desc: "포인트 선물" },
      ],
    },
    {
      title: "🔤 자모연성",
      color: "#34d399",
      cmds: [
        { cmd: "@초능력자 자모연성",         desc: "게임 시작 (기본: 보통)" },
        { cmd: "@초능력자 자모연성 쉬움",    desc: "2글자 · 1,780P" },
        { cmd: "@초능력자 자모연성 보통",    desc: "3글자 · 2,670P" },
        { cmd: "@초능력자 자모연성 어려움",  desc: "4글자 · 4,000P" },
        { cmd: "@초능력자 자모포기",         desc: "진행 중 포기" },
      ],
    },
    {
      title: "🏛️ 유물 시스템",
      color: "#f59e0b",
      cmds: [
        { cmd: "@초능력자 내유물",     desc: "보유 유물 확인" },
        { cmd: "@초능력자 유물보관함", desc: "보관 유물 목록" },
        { cmd: "@초능력자 유물강화",   desc: "메인 유물 강화" },
        { cmd: "@초능력자 유물합성",   desc: "보관 유물 합성" },
        { cmd: "@초능력자 유물분해",   desc: "유물 분해 · 포인트 환급" },
        { cmd: "@초능력자 유물뽑기",   desc: "포인트로 직접 뽑기" },
      ],
    },
  ];

  return (
    <section className="section cmd-section" id="commands">
      <div className="container">
        <div className="eyebrow reveal">사용법</div>
        <h2 className="section-h reveal">명령어</h2>
        <div className="cmd-nav reveal">
          <button
            className="cmd-nav-btn"
            onClick={() => scroll(-1)}
            disabled={!canLeft}
            aria-label="이전 카드"
          >‹</button>
          <span className="cmd-scroll-hint">좌우로 스크롤</span>
          <button
            className="cmd-nav-btn"
            onClick={() => scroll(1)}
            disabled={!canRight}
            aria-label="다음 카드"
          >›</button>
        </div>
      </div>
      <div className="cmd-scroll-outer">
      <div className="cmd-scroll-wrap reveal" ref={scrollRef}>
        {groups.map((g) => (
          <div key={g.title} className="cmd-card">
            <div className="terminal">
              <div className="terminal-bar">
                <span className="dot-r" /><span className="dot-y" /><span className="dot-g" />
                <span className="cmd-card-title" style={{ color: g.color }}>{g.title}</span>
              </div>
              <div className="terminal-body">
                {g.cmds.map((c, i) => (
                  <div key={i} className="terminal-row">
                    <span className="t-prompt" style={{ color: g.color }}>›</span>
                    <span className="t-cmd">{c.cmd}</span>
                    <span className="t-comment">// {c.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="footer">
      <img src={heroImage} alt="초능력자" className="footer-img" />
      <p className="footer-name">초능력자</p>
      <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
      <p className="footer-sub">This Website and the Chatbot '초능력자' were created and are maintained by 혁도동.</p>
      <div className="footer-links">
        <Link to="/legal"      className="footer-policy-link">개인정보처리방침 &amp; 이용약관</Link>
        <Link to="/contact"    className="footer-policy-link">연락처</Link>
        <Link to="/patchnotes" className="footer-policy-link">패치노트</Link>
        <Link to="/balance"    className="footer-policy-link">유물밸런스</Link>
      </div>
    </footer>
  );
}

/* ── Main ── */
function MainPage() {
  useReveal();
  return (
    <>
      <Nav />
      <Hero />
      <StatsSection />
      <Modes />
      <RankingSection />
      <Commands />
      <Footer />
    </>
  );
}

const RANK_DOMAIN = "rank.chosung.app";
const RANK_URL = "https://rank.chosung.app";

function RankRedirect() {
  const isProd = window.location.hostname.endsWith("chosung.app");
  useEffect(() => {
    if (isProd) window.location.replace(RANK_URL);
  }, []);
  if (!isProd) return <RankingPage />;
  return null;
}

function useRecordVisit() {
  useEffect(() => {
    const base: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";
    fetch(`${base}/stats/visit`, { method: "POST" }).catch(() => {});
  }, []);
}

export default function App() {
  useRecordVisit();
  const isRankDomain = window.location.hostname === RANK_DOMAIN;

  if (isRankDomain) {
    return (
      <Routes>
        <Route path="*" element={<RankingPage />} />
      </Routes>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/ranking" element={<RankRedirect />} />
        <Route path="/legal"  element={<LegalPage />} />
        <Route path="/policy" element={<Navigate to="/legal" replace />} />
        <Route path="/terms"  element={<Navigate to="/legal#terms" replace />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/patchnotes" element={<PatchNotesPage />} />
        <Route path="/detail/:mode" element={<DetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/balance" element={<BalancePage />} />
        <Route path="/donate"  element={<DonatePage />} />
      </Routes>
      <AdLayout />
    </>
  );
}
