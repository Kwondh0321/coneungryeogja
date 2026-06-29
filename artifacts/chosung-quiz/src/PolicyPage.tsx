import heroImage from "/chosung-hero3.png";
import { useNavigate, Link } from "react-router-dom";
import { useOgMeta } from "./hooks/use-og-meta";

const SECTIONS = [
  {
    title: "1. 수집하는 개인정보 항목",
    body: `초능력자 봇은 서비스 제공을 위해 아래와 같은 정보를 수집합니다.

• 카카오톡 사용자 ID (userId)
• 카카오톡 닉네임 (nickname)
• 게임 기록 (초능력포인트, 정답 횟수 등)
• 출석 체크 날짜
• 방(채팅방) 고유 ID`,
  },
  {
    title: "2. 개인정보 수집 및 이용 목적",
    body: `수집한 정보는 다음의 목적에만 사용됩니다.

• 게임 랭킹 시스템 운영 (방 내 순위, 서버 전체 순위)
• 출석 보상 지급 및 중복 방지
• 힌트 비용 차감 등 포인트 관리
• 서비스 개선을 위한 통계 분석 (개인 식별 불가 형태)`,
  },
  {
    title: "3. 개인정보 보유 및 이용 기간",
    body: `수집된 정보는 서비스 운영 기간 동안 보유됩니다.
서비스 종료 또는 이용자가 삭제를 요청할 경우 즉시 파기합니다.`,
  },
  {
    title: "4. 개인정보의 제3자 제공",
    body: `초능력자는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
단, 법령에 의한 경우는 예외로 합니다.`,
  },
  {
    title: "5. 개인정보 보호 조치",
    body: `수집된 데이터는 암호화된 데이터베이스에 저장되며 외부 접근이 제한됩니다.
민감 정보(비밀번호 등)는 별도 수집하지 않습니다.`,
  },
  {
    title: "6. 이용자 권리",
    body: `이용자는 언제든지 본인의 정보 조회, 수정, 삭제를 요청할 수 있습니다.
삭제 요청 시 게임 기록(포인트, 랭킹)이 모두 초기화됩니다.`,
  },
];

export default function PolicyPage() {
  const navigate = useNavigate();
  const base = (import.meta.env.BASE_URL as string) ?? "/";
  useOgMeta({
    title: "초능력자 - 개인정보처리방침",
    description: "초능력자 카카오톡 챗봇 서비스 개인정보처리방침",
    url: "https://chosung.app/policy",
  });
  const homeHref = base.endsWith("/") ? base : base + "/";

  return (
    <div className="policy-page">
      <nav className="nav">
        <a className="nav-logo" href={homeHref} style={{ textDecoration: "none" }}>
          <img src={heroImage} alt="" />
          <span>초능력자</span>
        </a>
        <div className="nav-links">
          <a href={homeHref} className="nav-link-plain">홈</a>
        </div>
      </nav>

      <main className="policy-main">
        <div className="policy-hero">
          <div className="eyebrow">법적 고지</div>
          <h1 className="policy-title">개인정보처리방침</h1>
          <p className="policy-effective">시행일: 2026년 4월 21일</p>
        </div>

        <div className="policy-container">
          <div className="policy-intro">
            초능력자 카카오톡 봇(이하 "서비스")은 이용자의 개인정보를 소중히 여기며,
            「개인정보 보호법」 및 관련 법령을 준수합니다.
            본 방침은 서비스가 수집하는 정보와 그 이용 방법을 설명합니다.
          </div>

          {SECTIONS.map((s, i) => (
            <div key={i} className="policy-section">
              <h2 className="policy-section-title">{s.title}</h2>
              <p className="policy-section-body">{s.body}</p>
            </div>
          ))}

          {/* 7. 문의 — 카드형 */}
          <div className="policy-section">
            <h2 className="policy-section-title">7. 문의</h2>
            <p className="policy-section-body">
              {"개인정보 처리 관련 문의는 카카오톡 오픈채팅으로 보내주세요.\n개발자: 권도혁 (혁도동) · 청주대학교 인공지능소프트웨어학과"}
            </p>
            <div className="pcc-cards">
              <a
                href="https://open.kakao.com/me/hyeokdodong"
                target="_blank"
                rel="noopener noreferrer"
                className="pcc-card"
              >
                <div className="pcc-icon">💬</div>
                <div className="pcc-body">
                  <p className="pcc-label">개인 오픈프로필</p>
                  <p className="pcc-title">혁도동 [초능력자봇 운영자]</p>
                  <p className="pcc-url">open.kakao.com</p>
                </div>
                <span className="pcc-arrow">→</span>
              </a>
              <a
                href="https://open.kakao.com/o/pqOPQEsi"
                target="_blank"
                rel="noopener noreferrer"
                className="pcc-card"
              >
                <div className="pcc-icon">🏠</div>
                <div className="pcc-body">
                  <p className="pcc-label">공식 오픈채팅방</p>
                  <p className="pcc-title">초능력자봇 공식 채팅방</p>
                  <p className="pcc-url">open.kakao.com</p>
                </div>
                <span className="pcc-arrow">→</span>
              </a>
            </div>
          </div>

          <div className="policy-footer-note">
            본 방침은 서비스 정책 변경에 따라 사전 고지 없이 수정될 수 있습니다.
          </div>
        </div>
      </main>

      <footer className="footer">
        <img src={heroImage} alt="초능력자" className="footer-img" />
        <p className="footer-name">초능력자</p>
        <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
        <div className="footer-links">
          <Link to="/policy"     className="footer-policy-link">개인정보처리방침</Link>
          <Link to="/terms"      className="footer-policy-link">이용약관</Link>
          <Link to="/contact"    className="footer-policy-link">연락처</Link>
          <Link to="/patchnotes" className="footer-policy-link">패치노트</Link>
          <Link to="/balance"    className="footer-policy-link">밸런싱 리포트</Link>
        </div>
      </footer>
    </div>
  );
}
