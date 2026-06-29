import heroImage from "/chosung-hero3.png";
import { Link, useNavigate } from "react-router-dom";
import { useOgMeta } from "./hooks/use-og-meta";

export default function ContactPage() {
  const navigate = useNavigate();
  useOgMeta({
    title: "초능력자 - 연락처",
    description: "초능력자 카카오톡 챗봇 서비스 운영자 연락처 및 문의 방법",
    url: "https://chosung.app/contact",
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
          <div className="eyebrow">문의 · 연락처</div>
          <h1 className="policy-title">Contact</h1>
          <p className="policy-effective">초능력자 봇 운영자에게 직접 연락하세요</p>
        </div>

        <div className="policy-container">
          <div className="policy-intro">
            버그 제보, 건의사항, 개인정보 삭제 요청, 서비스 문의 등은 아래 채널로 보내주세요.
            최대한 빠르게 답변드리겠습니다.
          </div>

          {/* 이메일 */}
          <div className="policy-section">
            <h2 className="policy-section-title">📧 이메일</h2>
            <p className="policy-section-body">
              공식 문의 이메일입니다. 개인정보 삭제 요청, 서비스 관련 질문, 제휴·협력 문의를 보내주세요.
            </p>
            <div className="pcc-cards">
              <a
                href="mailto:ehgur26753@gmail.com"
                className="pcc-card"
              >
                <div className="pcc-icon">📧</div>
                <div className="pcc-body">
                  <p className="pcc-label">공식 이메일</p>
                  <p className="pcc-title">ehgur26753@gmail.com</p>
                  <p className="pcc-url">클릭하면 메일 앱이 열려요</p>
                </div>
                <span className="pcc-arrow">→</span>
              </a>
            </div>
          </div>

          {/* 카카오톡 */}
          <div className="policy-section">
            <h2 className="policy-section-title">💬 카카오톡 채널</h2>
            <p className="policy-section-body">
              빠른 문의는 카카오톡 오픈채팅이나 개인 오픈프로필을 이용해 주세요.
            </p>
            <div className="pcc-cards">
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
                  <p className="pcc-url">open.kakao.com/o/pqOPQEsi</p>
                </div>
                <span className="pcc-arrow">→</span>
              </a>
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
                  <p className="pcc-url">open.kakao.com/me/hyeokdodong</p>
                </div>
                <span className="pcc-arrow">→</span>
              </a>
            </div>
          </div>

          {/* 운영자 정보 */}
          <div className="policy-section">
            <h2 className="policy-section-title">👤 운영자 정보</h2>
            <div className="policy-section-body" style={{ lineHeight: 2 }}>
              <strong>이름:</strong> 권도혁 (혁도동)<br />
              <strong>소속:</strong> 청주대학교 인공지능소프트웨어학과<br />
              <strong>이메일:</strong> ehgur26753@gmail.com<br />
              <strong>서비스명:</strong> 초능력자 (카카오톡 챗봇)<br />
              <strong>서비스 주소:</strong> chosung.app
            </div>
          </div>

          {/* 문의 유형 안내 */}
          <div className="policy-section">
            <h2 className="policy-section-title">📋 문의 유형별 안내</h2>
            {[
              { icon: "🐛", title: "버그 제보", desc: "게임 오작동, 포인트 오류, 명령어 미응답 등 버그를 발견하셨나요? 발생 상황을 구체적으로 설명해 주시면 빠르게 수정할게요." },
              { icon: "💡", title: "기능 건의", desc: "새로운 게임 모드, 명령어, 유물 효과 등 아이디어가 있으시면 언제든지 제안해 주세요. 적극적으로 검토하겠습니다." },
              { icon: "🗑️", title: "개인정보 삭제 요청", desc: "본인의 게임 기록, 포인트, 닉네임 등 모든 데이터 삭제를 원하시면 카카오톡 사용자 ID와 함께 요청해 주세요. 48시간 내 처리합니다." },
              { icon: "⚖️", title: "어뷰징 신고", desc: "매크로·자동화 프로그램 사용자나 부정 행위를 발견하셨나요? 증거 스크린샷과 함께 신고해 주시면 검토 후 조치합니다." },
            ].map((item, i) => (
              <div key={i} className="detail-card" style={{ marginBottom: 12 }}>
                <strong>{item.icon} {item.title}</strong><br />
                <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{item.desc}</span>
              </div>
            ))}
          </div>

          <div className="policy-footer-note">
            문의에 대한 답변은 이메일 또는 카카오톡으로 드립니다. 평균 응답 시간은 1~2일입니다.
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
