import { useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import heroImage from "/chosung-hero3-nobg.png";

const BANK    = "우리은행";
const ACCOUNT = "1002-666-175215";
const HOLDER  = "권도혁";

function DonatePage() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(ACCOUNT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div className="dp-root">
      <Helmet>
        <title>초능력자 후원 - 개발자를 응원해주세요</title>
        <meta name="description" content="초능력자 카카오톡 봇 개발자를 후원해주세요. 서버 운영과 신규 기능 개발에 큰 힘이 돼요." />
        <meta property="og:title" content="초능력자 후원 - 개발자를 응원해주세요" />
        <meta property="og:description" content="초능력자 카카오톡 봇 개발자를 후원해주세요. 서버 운영과 신규 기능 개발에 큰 힘이 돼요." />
        <meta property="og:image" content="https://chosung.app/chosung-og.png" />
        <meta property="og:url" content="https://chosung.app/donate" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ko_KR" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="초능력자 후원 - 개발자를 응원해주세요" />
        <meta name="twitter:description" content="초능력자 카카오톡 봇 개발자를 후원해주세요. 서버 운영과 신규 기능 개발에 큰 힘이 돼요." />
        <meta name="twitter:image" content="https://chosung.app/chosung-og.png" />
      </Helmet>

      {/* ── Nav ── */}
      <nav className="nav">
        <Link to="/" className="nav-logo" style={{ textDecoration: "none" }}>
          <img src={heroImage} alt="" />
          <span>초능력자</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-back-btn">← 메인으로</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="dp-hero">
        <div className="dp-hero-badge">개발자 후원</div>
        <h1 className="dp-hero-title">
          초능력자를<br />
          <span className="dp-hero-grad">응원해주세요</span>
        </h1>
        <p className="dp-hero-sub">
          서버 운영비와 개발 시간을 후원으로 함께 만들어 가요.<br />
          여러분의 후원이 더 좋은 봇을 만드는 원동력이 돼요 ☕
        </p>
      </header>

      {/* ── Account ── */}
      <section className="dp-section">
        <div className="dp-container">
          <p className="dp-label">후원 계좌</p>
          <div className="dp-account-row">
            <span className="dp-bank">{BANK}</span>
            <span className="dp-acnum">{ACCOUNT}</span>
            <span className="dp-holder">{HOLDER}</span>
            <button
              className={`dp-copy-btn${copied ? " dp-copy-done" : ""}`}
              onClick={copy}
              aria-label="계좌번호 복사"
            >
              {copied
                ? <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l4 4 7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> 복사됨</>
                : <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> 복사</>
              }
            </button>
          </div>
          <p className="dp-account-note">계좌번호 클릭 시 자동으로 복사돼요</p>
          <p className="dp-why-contact">
            💬 문의는{" "}
            <a
              href="https://open.kakao.com/me/hyeokdodong"
              target="_blank"
              rel="noopener noreferrer"
              className="dp-kakao-link"
            >
              카카오톡 오픈채팅
            </a>
            {" "}으로 연락주세요.
          </p>
        </div>
      </section>

      {/* ── Why donate cards ── */}
      <section className="dp-section">
        <div className="dp-container">
          <p className="dp-section-eyebrow">후원금의 쓰임새</p>
          <h2 className="dp-section-title">후원금은 이렇게 쓰여요</h2>
          <div className="dp-why-grid">
            <div className="dp-why-card">
              <div className="dp-why-icon">🖥️</div>
              <h3 className="dp-why-h">서버 운영비</h3>
              <p className="dp-why-p">봇을 24시간 안정적으로 운영하기 위한 서버 비용에 사용돼요.</p>
            </div>
            <div className="dp-why-card">
              <div className="dp-why-icon">⚙️</div>
              <h3 className="dp-why-h">신규 기능 개발</h3>
              <p className="dp-why-p">새로운 게임 모드, 유물 시스템 확장 등 더 많은 콘텐츠를 만들어요.</p>
            </div>
            <div className="dp-why-card">
              <div className="dp-why-icon">🐛</div>
              <h3 className="dp-why-h">유지 보수</h3>
              <p className="dp-why-p">버그 수정과 성능 개선으로 더 쾌적한 봇 경험을 만들어요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reward teaser ── */}
      <section className="dp-section dp-reward-section">
        <div className="dp-container">
          <p className="dp-section-eyebrow">후원자 감사 예정</p>
          <h2 className="dp-section-title">아래의 방향성으로 감사의 마음을 전할 예정이에요</h2>
          <p className="dp-reward-sub">
            후원 금액에 따라 <strong>유물과 다양한 혜택</strong>을 드려요. 현재 개발 중이에요!
          </p>

          <div className="dp-tier-list">

            <div className="dp-tier-row">
              <div className="dp-tier-amount">5,000원+</div>
              <div className="dp-tier-content">
                <div className="dp-tier-title">☕ 커피 한 잔</div>
                <div className="dp-tier-items">
                  <span className="dp-tier-item">🏅 후원자 뱃지 (프로필 표시)</span>
                </div>
              </div>
            </div>

            <div className="dp-tier-row">
              <div className="dp-tier-amount">10,000원+</div>
              <div className="dp-tier-content">
                <div className="dp-tier-title">🍢 떡볶이 한 그릇</div>
                <div className="dp-tier-items">
                  <span className="dp-tier-item">🏅 후원자 뱃지</span>
                  <span className="dp-tier-item">✨ 후원자 칭호</span>
                  <span className="dp-tier-item dp-tier-item-bonus dp-relic-b">🔵 B등급 유물 1개</span>
                </div>
              </div>
            </div>

            <div className="dp-tier-row">
              <div className="dp-tier-amount">30,000원+</div>
              <div className="dp-tier-content">
                <div className="dp-tier-title">🍗 치킨 한 마리</div>
                <div className="dp-tier-items">
                  <span className="dp-tier-item">🏅 후원자 뱃지</span>
                  <span className="dp-tier-item">✨ 특별 칭호</span>
                  <span className="dp-tier-item">🌐 웹사이트 명예의 전당 등재</span>
                  <span className="dp-tier-item dp-tier-item-bonus dp-relic-a">🟣 A등급 유물 1개</span>
                </div>
              </div>
            </div>

            <div className="dp-tier-row">
              <div className="dp-tier-amount">50,000원+</div>
              <div className="dp-tier-content">
                <div className="dp-tier-title">🥩 삼겹살 한 판</div>
                <div className="dp-tier-items">
                  <span className="dp-tier-item">🏅 후원자 뱃지</span>
                  <span className="dp-tier-item">👑 특별 칭호 (닉네임 옆 표시)</span>
                  <span className="dp-tier-item">🌐 명예의 전당 등재</span>
                  <span className="dp-tier-item">🎨 프로필 특별 테두리</span>
                  <span className="dp-tier-item dp-tier-item-bonus dp-relic-s">🟡 S등급 유물 1개</span>
                </div>
              </div>
            </div>

            <div className="dp-tier-row dp-tier-top">
              <div className="dp-tier-amount dp-tier-amount-top">100,000원+</div>
              <div className="dp-tier-content">
                <div className="dp-tier-title">🎉 최고 후원자</div>
                <div className="dp-tier-items">
                  <span className="dp-tier-item">🏅 후원자 뱃지</span>
                  <span className="dp-tier-item">👑 최고 후원자 칭호</span>
                  <span className="dp-tier-item">🌐 명예의 전당 최상단 영구 등재</span>
                  <span className="dp-tier-item">🎨 프로필 특별 테두리 + 이펙트</span>
                  <span className="dp-tier-item dp-tier-item-bonus dp-relic-s">🟡 S등급 유물 — 원하는 종류로 여러 개</span>
                </div>
              </div>
            </div>

          </div>

          <p className="dp-reward-notice">
            🛠️ 위 내용은 아직 확정된 보상이 아니라 <strong>방향성 안내</strong>예요.
            사업자 없이 운영되는 개인 봇인 만큼, 후원이 단순한 판매처럼 비춰지지 않도록
            보상 방식을 신중하게 다듬고 있어요. 유물·칭호 지급 방식이 달라질 수 있으며,
            지금 후원해주신 분들께는 최선을 다해 감사를 전할게요.
          </p>
        </div>
      </section>

      {/* ── Thanks ── */}
      <section className="dp-thanks-section">
        <div className="dp-container" style={{ textAlign: "center" }}>
          <div className="dp-thanks-icon">💙</div>
          <h2 className="dp-thanks-title">후원해주셔서 감사합니다</h2>
          <p className="dp-thanks-sub">여러분의 응원 덕분에 초능력자가 계속 성장할 수 있어요.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <img src={heroImage} alt="초능력자" className="footer-img" />
        <p className="footer-name">초능력자</p>
        <p className="footer-sub">© 2026 혁도동. All rights reserved.</p>
        <div className="footer-links">
          <Link to="/policy" className="footer-policy-link">개인정보처리방침</Link>
          <Link to="/terms"  className="footer-policy-link">이용약관</Link>
          <Link to="/"       className="footer-policy-link">메인으로</Link>
        </div>
      </footer>
    </div>
  );
}

export default DonatePage;
