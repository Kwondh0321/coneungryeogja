import { useState } from "react";
import heroImage from "/chosung-hero3.png";
import { Link, useLocation } from "react-router-dom";
import { useOgMeta } from "./hooks/use-og-meta";

const PRIVACY_SECTIONS = [
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

const TERMS_SECTIONS = [
  {
    title: "제1조 (목적)",
    body: `본 약관은 혁도동(이하 "운영자")이 제공하는 카카오톡 챗봇 "초능력자" 및 관련 웹사이트(chosung.app, 이하 "서비스")의 이용에 관한 조건 및 절차를 규정함을 목적으로 합니다.`,
  },
  {
    title: "제2조 (서비스 내용)",
    body: `서비스는 카카오톡 채팅방 내에서 이용할 수 있는 퀴즈 및 게임 봇으로, 다음 기능을 제공합니다.

• 초성퀴즈: 초성 힌트를 보고 가장 빠르게 정답을 맞히는 게임
• 훈민정음: 제시된 초성으로 만들 수 있는 단어를 최대한 많이 입력하는 게임
• 자모연성: 한글 자모를 조합하여 4지선다 중 정답 단어를 맞히는 퍼즐 게임
• 유물 시스템: 게임 승리 시 유물 드롭, 강화·합성·분해 기능
• 콤보 시스템: 연속 승리 시 포인트 보너스 지급
• 배틀 시스템: 이용자 간 포인트를 걸고 진행하는 1:1 대결
• 랭킹 시스템: 누적 포인트 기반 서버 순위 제공
• 출석 체크: 매일 출석 시 포인트 보상 지급`,
  },
  {
    title: "제3조 (이용 자격)",
    body: `서비스는 카카오톡 계정을 보유한 누구나 이용할 수 있습니다.
단, 다음에 해당하는 경우 이용이 제한될 수 있습니다.

• 서비스 운영을 방해하거나 악용하는 행위를 하는 경우
• 자동화 프로그램(매크로, 봇 등)을 이용해 게임에 참여하는 경우
• 타인의 계정을 도용하거나 허위 정보를 입력하는 경우`,
  },
  {
    title: "제4조 (포인트 정책)",
    body: `서비스 내 포인트(P, 초능력포인트)는 다음 원칙에 따라 운영됩니다.

• 포인트는 서비스 내 게임 및 기능 이용을 위한 가상 재화이며, 실제 현금으로 환급되지 않습니다.
• 포인트는 게임 승리, 출석 체크, 미션 달성 등을 통해 획득할 수 있습니다.
• 포인트는 힌트 사용, 배틀 참여, 유물 강화·뽑기 등에 사용됩니다.
• 운영자는 서비스 균형 조정을 위해 포인트 지급 및 소모 기준을 변경할 수 있습니다.
• 서비스 종료 시 보유 포인트는 소멸됩니다.`,
  },
  {
    title: "제5조 (금지 행위)",
    body: `이용자는 다음 행위를 해서는 안 됩니다.

• 자동화 프로그램, 매크로, 스크립트 등을 이용한 게임 플레이
• 버그 또는 시스템 오류를 고의로 악용하여 포인트를 부정 취득하는 행위
• 타 이용자에게 욕설, 위협, 사기 등 불법·불건전한 행위
• 운영자의 사전 동의 없이 서비스를 상업적 목적으로 이용하는 행위
• 서비스의 안정적 운영을 방해하는 일체의 행위

금지 행위 적발 시 운영자는 해당 이용자의 포인트를 초기화하거나 서비스 이용을 제한할 수 있습니다.`,
  },
  {
    title: "제6조 (서비스 변경 및 중단)",
    body: `운영자는 다음 경우에 서비스를 변경하거나 일시적으로 중단할 수 있습니다.

• 서버 점검, 업데이트, 긴급 장애 대응
• 카카오톡 API 정책 변경 또는 서비스 종료
• 천재지변, 서비스 운영 불가 등 불가항력적 사유

서비스 변경 또는 중단으로 인한 손해에 대해 운영자는 책임을 지지 않습니다.`,
  },
  {
    title: "제7조 (면책 조항)",
    body: `• 서비스는 개인이 운영하는 비영리 프로젝트로, 어떠한 명시적·묵시적 보증도 제공하지 않습니다.
• 게임 결과, 포인트 손실, 서비스 중단 등으로 인한 손해에 대해 운영자는 책임을 지지 않습니다.
• 이용자 간 분쟁에 대해 운영자는 중재 의무를 지지 않습니다.`,
  },
  {
    title: "제8조 (약관 변경)",
    body: `운영자는 서비스 운영 정책 변경에 따라 본 약관을 수정할 수 있습니다.
변경된 약관은 chosung.app에 공지하며, 공지 후 서비스를 계속 이용하면 변경에 동의한 것으로 간주합니다.`,
  },
  {
    title: "제9조 (문의)",
    body: `서비스 이용약관 관련 문의는 아래 연락처로 보내주세요.\n이메일: ehgur26753@gmail.com\n카카오톡 오픈채팅: open.kakao.com/o/pqOPQEsi`,
  },
];

type LegalTab = "privacy" | "terms";

export default function LegalPage() {
  const { hash } = useLocation();
  const [tab, setTab] = useState<LegalTab>(hash === "#terms" ? "terms" : "privacy");

  const base = (import.meta.env.BASE_URL as string) ?? "/";
  const homeHref = base.endsWith("/") ? base : base + "/";

  useOgMeta({
    title: tab === "privacy" ? "초능력자 - 개인정보처리방침" : "초능력자 - 이용약관",
    description: "초능력자 카카오톡 챗봇 서비스 개인정보처리방침 및 이용약관",
    url: "https://chosung.app/legal",
  });

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
          <h1 className="policy-title">개인정보처리방침 &amp; 이용약관</h1>
        </div>

        <div className="policy-container">
          {/* 탭 */}
          <div className="legal-tabs">
            <button
              className={`legal-tab-btn${tab === "privacy" ? " legal-tab-active" : ""}`}
              onClick={() => setTab("privacy")}
            >
              🔒 개인정보처리방침
            </button>
            <button
              className={`legal-tab-btn${tab === "terms" ? " legal-tab-active" : ""}`}
              onClick={() => setTab("terms")}
            >
              📋 이용약관
            </button>
          </div>

          {tab === "privacy" && (
            <>
              <div className="policy-intro">
                초능력자 카카오톡 봇(이하 "서비스")은 이용자의 개인정보를 소중히 여기며,
                「개인정보 보호법」 및 관련 법령을 준수합니다.
                본 방침은 서비스가 수집하는 정보와 그 이용 방법을 설명합니다.
              </div>
              <p className="policy-effective">시행일: 2026년 4월 21일</p>

              {PRIVACY_SECTIONS.map((s, i) => (
                <div key={i} className="policy-section">
                  <h2 className="policy-section-title">{s.title}</h2>
                  <p className="policy-section-body" style={{ whiteSpace: "pre-line" }}>{s.body}</p>
                </div>
              ))}

              <div className="policy-section">
                <h2 className="policy-section-title">7. 문의</h2>
                <p className="policy-section-body">
                  {"개인정보 처리 관련 문의는 카카오톡 오픈채팅으로 보내주세요.\n개발자: 권도혁 (혁도동) · 청주대학교 인공지능소프트웨어학과"}
                </p>
                <div className="pcc-cards">
                  <a href="https://open.kakao.com/me/hyeokdodong" target="_blank" rel="noopener noreferrer" className="pcc-card">
                    <div className="pcc-icon">💬</div>
                    <div className="pcc-body">
                      <p className="pcc-label">개인 오픈프로필</p>
                      <p className="pcc-title">혁도동 [초능력자봇 운영자]</p>
                      <p className="pcc-url">open.kakao.com</p>
                    </div>
                    <span className="pcc-arrow">→</span>
                  </a>
                  <a href="https://open.kakao.com/o/pqOPQEsi" target="_blank" rel="noopener noreferrer" className="pcc-card">
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
            </>
          )}

          {tab === "terms" && (
            <>
              <div className="policy-intro">
                "초능력자" 서비스를 이용하시기 전에 본 이용약관을 주의 깊게 읽어주시기 바랍니다.
                서비스를 이용하시면 본 약관에 동의하신 것으로 간주됩니다.
              </div>
              <p className="policy-effective">시행일: 2026년 5월 10일</p>

              {TERMS_SECTIONS.map((s, i) => (
                <div key={i} className="policy-section">
                  <h2 className="policy-section-title">{s.title}</h2>
                  <p className="policy-section-body" style={{ whiteSpace: "pre-line" }}>{s.body}</p>
                </div>
              ))}

              <div className="policy-footer-note">
                본 약관은 서비스 정책 변경에 따라 수정될 수 있습니다. (최종 수정: 2026년 5월 10일)
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <img src={heroImage} alt="초능력자" className="footer-img" />
        <p className="footer-name">초능력자</p>
        <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
        <div className="footer-links">
          <Link to="/legal"      className="footer-policy-link">개인정보처리방침 &amp; 이용약관</Link>
          <Link to="/contact"    className="footer-policy-link">연락처</Link>
          <Link to="/patchnotes" className="footer-policy-link">패치노트</Link>
          <Link to="/balance"    className="footer-policy-link">유물밸런스</Link>
        </div>
      </footer>
    </div>
  );
}
