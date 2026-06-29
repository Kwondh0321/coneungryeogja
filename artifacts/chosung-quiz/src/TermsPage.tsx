import heroImage from "/chosung-hero3.png";
import { Link, useNavigate } from "react-router-dom";
import { useOgMeta } from "./hooks/use-og-meta";

const SECTIONS = [
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

export default function TermsPage() {
  const navigate = useNavigate();
  useOgMeta({
    title: "초능력자 - 이용약관",
    description: "초능력자 카카오톡 챗봇 서비스 이용약관",
    url: "https://chosung.app/terms",
  });

  return (
    <div className="policy-page">
      <nav className="nav">
        <div className="nav-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
          <img src={heroImage} alt="" />
          <span>초능력자</span>
        </div>
        <div className="nav-links">
          <button onClick={() => navigate("/")}>홈</button>
        </div>
      </nav>

      <main className="policy-main">
        <div className="policy-hero">
          <div className="eyebrow">법적 고지</div>
          <h1 className="policy-title">이용약관</h1>
          <p className="policy-effective">시행일: 2026년 5월 10일</p>
        </div>

        <div className="policy-container">
          <div className="policy-intro">
            "초능력자" 서비스를 이용하시기 전에 본 이용약관을 주의 깊게 읽어주시기 바랍니다.
            서비스를 이용하시면 본 약관에 동의하신 것으로 간주됩니다.
          </div>

          {SECTIONS.map((s, i) => (
            <div key={i} className="policy-section">
              <h2 className="policy-section-title">{s.title}</h2>
              <p className="policy-section-body" style={{ whiteSpace: "pre-line" }}>{s.body}</p>
            </div>
          ))}

          <div className="policy-footer-note">
            본 약관은 서비스 정책 변경에 따라 수정될 수 있습니다. (최종 수정: 2026년 5월 10일)
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
