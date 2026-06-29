import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useOgMeta } from "./hooks/use-og-meta";
import heroImage from "/chosung-hero3.png";



function DetailNav() {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="nav-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
        <img src={heroImage} alt="" />
        <span>초능력자</span>
      </div>
      <div className="nav-links">
        <button onClick={() => navigate("/")}>홈</button>
        <button onClick={() => navigate("/ranking")}>🏆 랭킹</button>
      </div>
    </nav>
  );
}

function DetailFooter() {
  return (
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
  );
}

function BackBtn() {
  const navigate = useNavigate();
  return (
    <button className="detail-back-btn" onClick={() => navigate("/")}>
      ← 메인으로 돌아가기
    </button>
  );
}

/* ── 초성퀴즈 ── */
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function ChosungDetail() {
  const [categories, setCategories] = useState<string[]>([]);
  const [catCount, setCatCount] = useState<number>(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/kakao/categories`)
      .then(r => r.json())
      .then(d => { setCategories(d.categories ?? []); setCatCount(d.count ?? 0); })
      .catch(() => {});
  }, []);

  return (
    <div className="detail-page">
      <DetailNav />
      <div className="detail-hero detail-hero-orange">
        <div className="detail-hero-icon">⚡</div>
        <div className="detail-hero-tag tag-orange">단일 정답</div>
        <h1 className="detail-hero-title">초성퀴즈</h1>
        <p className="detail-hero-sub">가장 빠른 한 명만 정답! 속도와 지식으로 승부하는 초성 맞추기 게임</p>
      </div>

      <div className="detail-body">
        <BackBtn />

        <div className="detail-section">
          <h2 className="detail-section-h">🎮 게임 방법</h2>
          <div className="detail-step-list">
            {[
              { title: "봇이 초성 힌트 공개", desc: "랜덤 또는 선택한 카테고리에서 문제가 출제돼요. 초성만 보고 정답을 유추해야 해요." },
              { title: "채팅에 정답 입력", desc: "가장 빠르게 정확한 답을 입력하면 돼요. 오답은 무시되니 과감하게 입력해보세요!" },
              { title: "먼저 맞춘 한 명이 포인트 획득", desc: "정답은 오직 한 명에게만 인정돼요. 속도가 곧 실력이에요." },
            ].map((s, i) => (
              <div key={i} className="detail-step">
                <div className="detail-step-num sn-orange">{i + 1}</div>
                <div className="detail-step-text"><strong>{s.title}</strong><br />{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">💡 주요 특징</h2>
          <div className="detail-highlight detail-highlight-orange">
            📚 현재 <strong>{catCount > 0 ? `${catCount}개 카테고리 · 4,900+ 문제` : "로딩 중..."}</strong>가 수록되어 있어요.<br />
            카테고리를 지정하거나 랜덤으로 즐길 수 있어요.
          </div>
          <div className="detail-card">
            <strong>💡 힌트 사용</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              모르는 문제는 <code>@초능력자 힌트</code>를 사용하세요. 초성 중 하나를 글자로 공개해줘요.<br />
              단, <strong>20P</strong>가 소모됩니다.
            </span>
          </div>
          <div className="detail-card">
            <strong>🔥 콤보 시스템 연계</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              초성퀴즈·훈민정음·자모연성 중 어떤 게임이든 10분 내 5번 이기면 <strong>+20% 보너스</strong>가 즉시 발동해요.
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">📂 카테고리 목록 ({catCount > 0 ? `${catCount}개` : "로딩 중"})</h2>
          <div className="detail-cat-grid">
            {categories.length > 0
              ? categories.map((cat) => <span key={cat} className="detail-cat-chip">{cat}</span>)
              : <span style={{ color: "var(--muted)", fontSize: "14px" }}>카테고리 불러오는 중...</span>
            }
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">💰 포인트 보상 안내</h2>
          <div className="detail-highlight detail-highlight-orange">
            초성퀴즈 기본 보상은 <strong>문제 난이도와 힌트 사용 여부</strong>에 따라 달라져요.
          </div>
          <div className="detail-info-row">
            <div className="detail-badge">📦 힌트 미사용 — 기본 포인트 100%</div>
            <div className="detail-badge">💡 힌트 1회 사용 — 포인트 감소</div>
            <div className="detail-badge">🔥 콤보 발동 중 — +20% 추가</div>
          </div>
          <div className="detail-card">
            <strong>🏛️ 유물 효과 연동</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              랜턴 유물을 장착하면 초성퀴즈에서 획득하는 포인트가 추가로 증가해요.
              유물 등급과 강화 수치가 높을수록 보너스도 커집니다.
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎯 전략 팁</h2>
          {[
            { title: "카테고리를 미리 파악하세요", desc: "자신 있는 카테고리를 지정해서 시작하면 정답률이 크게 올라가요. 동물, 음식, 연예인 등 다양한 카테고리가 있어요." },
            { title: "힌트는 신중하게 사용하세요", desc: "힌트를 쓰면 포인트가 줄어들어요. 확실히 모를 때만 사용하고, 짐작이 가면 과감하게 입력해보세요." },
            { title: "콤보 발동 중 집중 플레이", desc: "콤보 +20% 보너스가 발동된 60초 동안 초성퀴즈를 연속으로 맞히면 포인트 효율이 극대화돼요." },
          ].map((t, i) => (
            <div key={i} className="detail-card">
              <strong>💡 {t.title}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{t.desc}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">❓ 자주 묻는 질문</h2>
          {[
            { q: "동시에 두 명이 정답을 입력하면?", a: "서버에 먼저 도달한 메시지만 정답으로 인정됩니다. 네트워크 속도 차이가 미묘하게 결과에 영향을 줄 수 있어요." },
            { q: "오답을 입력하면 패널티가 있나요?", a: "오답에 대한 패널티는 없어요. 틀려도 다시 입력할 수 있으니 과감하게 시도해보세요!" },
            { q: "카테고리에 없는 단어가 정답으로 나오기도 하나요?", a: "각 카테고리는 해당 주제에 맞는 단어로만 구성되어 있어요. 하지만 '랜덤'으로 시작하면 모든 카테고리에서 출제돼요." },
            { q: "게임이 시작됐는데 아무도 못 맞히면?", a: "일정 시간이 지나도 정답자가 없으면 봇이 자동으로 정답을 공개하고 게임을 종료해요." },
          ].map((item, i) => (
            <div key={i} className="detail-card" style={{ borderLeft: "3px solid rgba(3,105,161,0.4)" }}>
              <strong style={{ color: "#0EA5E9" }}>Q. {item.q}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>A. {item.a}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⌨️ 명령어</h2>
          <div className="detail-cmd-list">
            {[
              { cmd: "@초능력자 초성퀴즈",          desc: "전체 랜덤으로 시작" },
              { cmd: "@초능력자 초성퀴즈 동물",      desc: "카테고리 지정 시작 (예: 동물)" },
              { cmd: "@초능력자 힌트",              desc: "힌트 사용 (100P 소모)" },
              { cmd: "@초능력자 종료",              desc: "진행 중인 게임 종료" },
            ].map((c, i) => (
              <div key={i} className="detail-cmd-row">
                <span className="detail-cmd-code">{c.cmd}</span>
                <span className="detail-cmd-desc">// {c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DetailFooter />
    </div>
  );
}

/* ── 훈민정음 ── */
function HunminDetail() {
  return (
    <div className="detail-page">
      <DetailNav />
      <div className="detail-hero detail-hero-blue">
        <div className="detail-hero-icon">📖</div>
        <div className="detail-hero-tag tag-blue">복수 정답</div>
        <h1 className="detail-hero-title">훈민정음</h1>
        <p className="detail-hero-sub">아는 단어를 전부 입력하세요! 많이 맞출수록 승리에 가까워지는 단어 배틀</p>
      </div>

      <div className="detail-body">
        <BackBtn />

        <div className="detail-section">
          <h2 className="detail-section-h">🎮 게임 방법</h2>
          <div className="detail-step-list">
            {[
              { title: "참여자 등록", desc: "@초능력자 참여 로 먼저 등록해야 해요. 훈민정음은 사전 참여 신청이 필요한 팀 배틀이에요." },
              { title: "봇이 초성 공개", desc: "제시된 초성으로 만들 수 있는 단어를 최대한 많이 입력해요. 맞는 단어면 전부 인정!" },
              { title: "제한 시간 내 최다 정답자 승리", desc: "시간이 끝나면 가장 많은 정답을 입력한 참여자가 포인트를 획득해요." },
            ].map((s, i) => (
              <div key={i} className="detail-step">
                <div className="detail-step-num sn-blue">{i + 1}</div>
                <div className="detail-step-text"><strong>{s.title}</strong><br />{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">💡 주요 특징</h2>
          <div className="detail-highlight detail-highlight-blue">
            📚 <strong>75,221개</strong>의 방대한 한국어 단어 사전이 내장되어 있어요.<br />
            2~4글자 표준어 위주로 구성되어 있어요.
          </div>
          <div className="detail-card">
            <strong>✅ 복수 정답 모두 인정</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              초성퀴즈와 다르게 해당 초성으로 만들 수 있는 단어라면 <strong>전부 정답으로 인정</strong>돼요.<br />
              예) 초성 "ㄱ ㅊ" → 김치 ✓ · 고추 ✓ · 고체 ✓ 모두 인정
            </span>
          </div>
          <div className="detail-card">
            <strong>🤝 참여자 등록 필수</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              게임 시작 전 <code>@초능력자 참여</code>로 등록한 멤버만 점수가 집계돼요.<br />
              한 번 등록하면 채팅방에서 계속 유지돼요.
            </span>
          </div>
          <div className="detail-card">
            <strong>🔥 콤보 시스템 연계</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              어떤 게임이든 10분 내 5번 이기면 콤보 +20% 보너스가 즉시 발동해요.
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">💰 포인트 보상 안내</h2>
          <div className="detail-highlight detail-highlight-blue">
            훈민정음은 <strong>단어 1개당 2,500P</strong>가 기본 보상이에요.<br />
            게임이 끝나면 가장 많은 정답을 맞힌 사람(MVP)에게 <strong>+12,000P</strong> 보너스가 지급돼요.
          </div>
          <div className="detail-info-row">
            <div className="detail-badge">📝 단어 1개 — 2,500P</div>
            <div className="detail-badge">🏆 MVP 보너스 — +12,000P</div>
            <div className="detail-badge">🔥 콤보 발동 중 — +20% 추가</div>
          </div>
          <div className="detail-card">
            <strong>🏛️ 유물 효과 연동</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              거울 유물을 장착하면 훈민정음에서 획득하는 포인트가 추가로 증가해요.
              정답을 많이 맞힐수록 유물 보너스 효과가 더 크게 느껴져요.
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎯 전략 팁</h2>
          {[
            { title: "짧은 단어부터 빠르게 입력하세요", desc: "2~3글자 단어는 조합이 많아요. 먼저 떠오르는 단어를 빠르게 입력하고, 그다음 4글자 단어를 공략하세요." },
            { title: "겹치지 않게 다양한 단어를 노려요", desc: "같은 단어를 두 번 입력해도 한 번만 인정돼요. 최대한 다양한 단어를 생각해내는 것이 중요해요." },
            { title: "콤보 발동 타이밍에 참여하세요", desc: "콤보 보너스가 활성화된 상태에서 훈민정음 MVP를 달성하면 포인트가 폭발적으로 늘어나요." },
          ].map((t, i) => (
            <div key={i} className="detail-card">
              <strong>💡 {t.title}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{t.desc}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">❓ 자주 묻는 질문</h2>
          {[
            { q: "참여 등록은 한 번만 하면 되나요?", a: "네, 한 번 등록하면 채팅방에서 계속 유지돼요. 채팅방이 바뀌면 새로 등록해야 합니다." },
            { q: "사전에 없는 단어를 입력하면?", a: "75,221개의 표준 한국어 사전을 기준으로 판별해요. 사전에 없는 신조어·줄임말은 인정되지 않아요." },
            { q: "힌트를 사용하면 점수가 줄어드나요?", a: "힌트를 쓰면 보유 포인트에서 100P가 차감되지만, 단어 정답 보상 자체는 줄지 않아요. 단어를 더 많이 맞혀서 본전을 뽑을 수 있어요." },
            { q: "제한 시간은 얼마나 되나요?", a: "게임마다 정해진 제한 시간 안에 최대한 많은 단어를 입력해야 해요. 시간이 끝나면 봇이 결과를 집계해 발표해요." },
          ].map((item, i) => (
            <div key={i} className="detail-card" style={{ borderLeft: "3px solid rgba(96,165,250,0.4)" }}>
              <strong style={{ color: "#60a5fa" }}>Q. {item.q}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>A. {item.a}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⌨️ 명령어</h2>
          <div className="detail-cmd-list">
            {[
              { cmd: "@초능력자 훈민정음",   desc: "게임 시작" },
              { cmd: "@초능력자 참여", desc: "참여자 등록" },
              { cmd: "@초능력자 힌트",       desc: "초성 중 한 글자 공개 (100P)" },
              { cmd: "@초능력자 종료",       desc: "진행 중인 게임 종료" },
            ].map((c, i) => (
              <div key={i} className="detail-cmd-row">
                <span className="detail-cmd-code">{c.cmd}</span>
                <span className="detail-cmd-desc">// {c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DetailFooter />
    </div>
  );
}

/* ── 콤보 시스템 ── */
function ComboDetail() {
  return (
    <div className="detail-page">
      <DetailNav />
      <div className="detail-hero detail-hero-purple">
        <div className="detail-hero-icon">🔥</div>
        <div className="detail-hero-tag tag-purple">콤보 보너스</div>
        <h1 className="detail-hero-title">콤보 시스템</h1>
        <p className="detail-hero-sub">세 게임 중 어떤 게임이든 10분 내 5번 이기면 발동! 60초간 +20% 보너스로 포인트를 폭발적으로 늘리세요</p>
      </div>

      <div className="detail-body">
        <BackBtn />

        <div className="detail-section">
          <h2 className="detail-section-h">🔥 콤보 발동 조건</h2>
          <div className="detail-combo-flow">
            <div className="detail-combo-wins">
              <span className="detail-combo-chip cc-orange">⚡ 게임 승리</span>
              <span className="detail-combo-chip cc-blue">⚡ 게임 승리</span>
              <span className="detail-combo-chip cc-orange">⚡ 게임 승리</span>
              <span className="detail-combo-chip cc-blue">⚡ 게임 승리</span>
              <span className="detail-combo-chip cc-orange">⚡ 5번째 승리</span>
            </div>
            <div className="detail-combo-arrow">↓</div>
            <div className="detail-combo-result">🔥 콤보 발동! +20% 즉시 적용</div>
          </div>
          <div className="detail-step-list" style={{ marginTop: "16px" }}>
            {[
              { title: "게임 종류 무관", desc: "초성퀴즈·훈민정음·자모연성 세 게임 어디서 이겨도 모두 카운트돼요. 섞어도 OK!" },
              { title: "10분 이내 5번 승리", desc: "첫 번째 승리로부터 10분 안에 5번을 달성해야 해요. 시간이 초과되면 카운트가 리셋돼요." },
              { title: "콤보 발동 → 60초간 +20%", desc: "발동되면 60초 동안 게임에서 얻는 모든 포인트에 +20%가 추가돼요. 콤보 중엔 카운터가 멈추고, 만료 후 다시 쌓기 시작해요." },
            ].map((s, i) => (
              <div key={i} className="detail-step">
                <div className="detail-step-num sn-purple">{i + 1}</div>
                <div className="detail-step-text"><strong>{s.title}</strong><br />{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">✨ 콤보 효과</h2>
          <div className="detail-info-row">
            <div className="detail-badge">⏱️ 지속 시간 <strong style={{ marginLeft: "6px" }}>60초</strong></div>
            <div className="detail-badge">💎 보너스 <strong style={{ marginLeft: "6px", color: "#0369A1" }}>+20%</strong></div>
            <div className="detail-badge">🔄 반복 가능</div>
          </div>
          <div className="detail-highlight">
            콤보 60초가 끝나면 카운터가 다시 쌓이기 시작해요.<br />
            5회 달성 → 60초 보너스 → 만료 후 다시 5회 달성을 반복할 수 있어요!
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎯 전략 팁</h2>
          <div className="detail-card">
            <strong>🎮 세 게임 모두 활용</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              초성퀴즈·훈민정음·자모연성 중 자신 있는 게임을 집중 공략하세요. 단일 게임만 연속으로 이겨도 콤보가 발동돼요.
            </span>
          </div>
          <div className="detail-card">
            <strong>🏆 랭킹 역전의 기회</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              콤보를 활용하면 짧은 시간에 많은 포인트를 얻을 수 있어요. 랭킹 역전 찬스!
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">❓ 자주 묻는 질문</h2>
          {[
            { q: "콤보 카운트는 어디서 확인할 수 있나요?", a: "@초능력자 내정보 또는 @초능력자 프로필 명령어로 현재 콤보 누적 현황을 확인할 수 있어요." },
            { q: "콤보 발동 중에 게임을 이기면 카운트가 쌓이나요?", a: "아니요. 콤보 활성화(60초) 중에는 카운터가 멈춰요. 콤보가 만료되면 다시 카운트가 시작돼요." },
            { q: "다른 채팅방에서 이긴 것도 카운트되나요?", a: "콤보는 유저 개인 단위로 관리돼요. 어느 채팅방에서 이기든 동일한 콤보 카운터에 누적돼요." },
            { q: "10분을 초과하면 카운트가 0으로 초기화되나요?", a: "네. 첫 번째 승리 시점으로부터 10분이 지나면 카운트가 리셋됩니다. 빠르게 연속 승리를 노려야 해요!" },
          ].map((item, i) => (
            <div key={i} className="detail-card" style={{ borderLeft: "3px solid rgba(3,105,161,0.4)" }}>
              <strong style={{ color: "#0EA5E9" }}>Q. {item.q}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>A. {item.a}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⌨️ 관련 명령어</h2>
          <div className="detail-cmd-list">
            {[
              { cmd: "@초능력자 초성퀴즈", desc: "초성퀴즈 시작" },
              { cmd: "@초능력자 훈민정음", desc: "훈민정음 시작" },
              { cmd: "@초능력자 자모연성", desc: "자모연성 시작" },
            ].map((c, i) => (
              <div key={i} className="detail-cmd-row">
                <span className="detail-cmd-code">{c.cmd}</span>
                <span className="detail-cmd-desc">// {c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DetailFooter />
    </div>
  );
}

/* ── 자모연성 ── */
function JamoDetail() {
  return (
    <div className="detail-page">
      <DetailNav />
      <div className="detail-hero detail-hero-green">
        <div className="detail-hero-icon">🔤</div>
        <div className="detail-hero-tag tag-green">자모 퍼즐</div>
        <h1 className="detail-hero-title">자모연성</h1>
        <p className="detail-hero-sub">흩어진 한글 자모를 조합해 정답 단어를 맞히는 퍼즐 게임!</p>
      </div>

      <div className="detail-body">
        <BackBtn />

        <div className="detail-section">
          <h2 className="detail-section-h">🎮 게임 방법</h2>
          <div className="detail-step-list">
            {[
              { title: "자모 목록 공개", desc: "정답 단어의 자모가 교란 자모와 섞여 표시돼요. 이 자모들로 만들 수 있는 단어를 찾아야 해요." },
              { title: "4개 보기 중 선택", desc: "4개의 단어 보기 중 자모 목록으로 만들 수 있는 단어를 선택해요. 채팅창에 1/2/3/4 중 하나를 입력하세요." },
              { title: "정답 시 포인트 획득", desc: "정답을 맞히면 기본 포인트에 각종 보너스가 더해져요. 연속으로 맞힐수록 보너스가 커져요!" },
            ].map((s, i) => (
              <div key={i} className="detail-step">
                <div className="detail-step-num sn-green">{i + 1}</div>
                <div className="detail-step-text"><strong>{s.title}</strong><br />{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⚙️ 난이도별 포인트</h2>
          <div className="detail-info-row">
            <div className="detail-badge">🟢 쉬움 — 2글자 · 기본 1,780P</div>
            <div className="detail-badge">🔵 보통 — 3글자 · 기본 2,670P</div>
            <div className="detail-badge">🔴 어려움 — 4글자 · 기본 4,000P</div>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎁 보너스 시스템</h2>
          <div className="detail-highlight detail-highlight-green">
            여러 조건을 달성하면 기본 포인트에 추가 보너스가 붙어요!
          </div>
          {[
            { title: "📏 긴 단어 보너스",      desc: "+670P — 3글자 이상 정답 시 추가돼요." },
            { title: "받침 보너스",            desc: "+440P — 정답 단어에 받침이 있으면 추가돼요." },
            { title: "🌟 첫 자모연성 보너스",   desc: "+1,110P — 하루 처음 자모연성을 성공하면 추가돼요." },
            { title: "🔥 연속 3회 보너스",      desc: "+2,220P — 연속으로 3의 배수 회차 정답을 맞히면 추가돼요." },
          ].map((c, i) => (
            <div key={i} className="detail-card">
              <strong>{c.title}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{c.desc}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎯 전략 팁</h2>
          {[
            { title: "어려움 난이도가 효율이 가장 높아요", desc: "기본 4,000P + 긴단어 보너스 + 받침 보너스까지 받으면 최대 5,110P 이상을 한 판에 얻을 수 있어요." },
            { title: "연속 3회 보너스를 노리세요", desc: "3의 배수(3, 6, 9, 12…)회차에 연속으로 맞히면 +2,220P 보너스가 붙어요. 연속 플레이로 복리처럼 포인트가 쌓여요." },
            { title: "보물함 유물로 효율을 높이세요", desc: "보물함 유물을 장착하면 자모연성 포인트가 추가로 증가해요. 자모연성을 주로 즐긴다면 보물함을 우선 강화하세요." },
          ].map((t, i) => (
            <div key={i} className="detail-card">
              <strong>💡 {t.title}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{t.desc}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">❓ 자주 묻는 질문</h2>
          {[
            { q: "자모가 뭔가요? 어떻게 조합하나요?", a: "자모란 한글의 자음(ㄱ,ㄴ,ㄷ…)과 모음(ㅏ,ㅑ,ㅓ…)을 말해요. 제시된 자모를 순서에 상관없이 조합해 단어를 만들 수 있는지 판별하면 돼요." },
            { q: "답을 틀리면 어떻게 되나요?", a: "오답을 선택하면 연속 정답 횟수가 0으로 초기화돼요. 연속 3회 보너스를 쌓고 있었다면 다시 처음부터 시작해야 해요." },
            { q: "하루에 몇 번이나 플레이할 수 있나요?", a: "자모연성은 횟수 제한이 없어요. 하지만 '첫 자모연성 보너스(+1,110P)'는 하루에 한 번만 받을 수 있어요." },
            { q: "제한 시간 내에 답을 입력해야 하나요?", a: "네. 문제가 출제된 후 일정 시간 내에 1~4 중 하나를 입력해야 해요. 시간이 초과되면 포기한 것으로 처리됩니다." },
          ].map((item, i) => (
            <div key={i} className="detail-card" style={{ borderLeft: "3px solid rgba(34,197,94,0.4)" }}>
              <strong style={{ color: "#22c55e" }}>Q. {item.q}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>A. {item.a}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⌨️ 명령어</h2>
          <div className="detail-cmd-list">
            {[
              { cmd: "@초능력자 자모연성",         desc: "게임 시작 (기본: 보통)" },
              { cmd: "@초능력자 자모연성 쉬움",     desc: "2글자 난이도 · 기본 1,780P" },
              { cmd: "@초능력자 자모연성 보통",     desc: "3글자 난이도 · 기본 2,670P" },
              { cmd: "@초능력자 자모연성 어려움",   desc: "4글자 난이도 · 기본 4,000P" },
              { cmd: "@초능력자 자모포기",          desc: "진행 중인 게임 포기" },
            ].map((c, i) => (
              <div key={i} className="detail-cmd-row">
                <span className="detail-cmd-code">{c.cmd}</span>
                <span className="detail-cmd-desc">// {c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DetailFooter />
    </div>
  );
}

/* ── 유물 시스템 ── */
function RelicDetail() {
  return (
    <div className="detail-page">
      <DetailNav />
      <div className="detail-hero detail-hero-amber">
        <div className="detail-hero-icon">🏛️</div>
        <div className="detail-hero-tag tag-amber">수집 · 강화</div>
        <h1 className="detail-hero-title">유물 시스템</h1>
        <p className="detail-hero-sub">게임 드롭으로 수집하고, 강화·합성으로 더 강력한 유물을 만드세요!</p>
      </div>

      <div className="detail-body">
        <BackBtn />

        <div className="detail-section">
          <h2 className="detail-section-h">⭐ 등급 시스템</h2>
          <div className="detail-highlight detail-highlight-amber">
            유물은 <strong>D → C → B → A → S</strong> 5단계 등급으로 구분돼요.<br />
            합성을 통해 하위 등급 여러 개를 상위 등급 1개로 만들 수 있어요.
          </div>
          <div className="relic-grade-list">
            {[
              { label: "⚪ D등급", color: "#9ca3af", bg: "rgba(156,163,175,0.08)", desc: "드롭 확률 4.41% — 가장 흔한 유물" },
              { label: "🟢 C등급", color: "#22c55e", bg: "rgba(34,197,94,0.08)",   desc: "드롭 확률 3.50% — 흔한 유물" },
              { label: "🔵 B등급", color: "#60a5fa", bg: "rgba(59,130,246,0.08)",  desc: "드롭 확률 0.48% — 희귀 유물" },
              { label: "🟣 A등급", color: "#0EA5E9", bg: "rgba(3,105,161,0.08)", desc: "드롭 확률 0.08% — 매우 희귀한 유물" },
              { label: "🟡 S등급", color: "#eab308", bg: "rgba(234,179,8,0.08)",  desc: "드롭 불가 — 합성으로만 획득 가능한 최상위 유물" },
            ].map((g, i) => (
              <div key={i} className="relic-grade-row" style={{ borderColor: g.color + "40", background: g.bg }}>
                <span className="relic-grade-label" style={{ color: g.color }}>{g.label}</span>
                <span className="relic-grade-desc">{g.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🗂️ 유물 종류 (8종)</h2>
          <div className="detail-highlight detail-highlight-amber">
            현재 <strong>8종</strong>의 유물이 있어요. 각 유물마다 고유한 효과를 가지고 있어요.
          </div>
          <div className="relic-type-grid">
            {[
              { icon: "🧭", name: "나침반",  effect: "모든 게임 포인트 +%" },
              { icon: "⏳", name: "모래시계", effect: "유물 강화 비용 감소" },
              { icon: "🔦", name: "랜턴",    effect: "초성퀴즈 포인트 +%" },
              { icon: "🪞", name: "거울",    effect: "훈민정음 포인트 +%" },
              { icon: "📦", name: "보물함",  effect: "자모연성 포인트 +%" },
              { icon: "👑", name: "왕관",    effect: "연속 정답 보너스 +%" },
              { icon: "🧪", name: "물약",    effect: "보관 유물 효과 증가" },
              { icon: "🪶", name: "깃털펜",  effect: "유물 경험치 획득 +%" },
            ].map((r, i) => (
              <div key={i} className="relic-type-card">
                <span className="relic-type-icon">{r.icon}</span>
                <span className="relic-type-name">{r.name}</span>
                <span className="relic-type-effect">{r.effect}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🔨 강화 &amp; 레벨업</h2>
          <div className="detail-card">
            <strong>⬆️ 레벨업 (최대 50단계)</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              포인트를 소비해 유물을 레벨업하면 효과값이 증가해요.
            </span>
          </div>
          <div className="detail-card">
            <strong>⚒️ 강화 (0 ~ +20강)</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              강화에는 성공률이 있어요. 강화 단계가 올라갈수록 성공률이 낮아지지만 효과값이 추가로 증가해요.
            </span>
          </div>
          <div className="detail-card">
            <strong>🔮 합성</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              같은 등급의 유물 여러 개를 소비해 한 단계 높은 등급의 유물을 제작할 수 있어요.
            </span>
          </div>
          <div className="detail-card">
            <strong>🗃️ 보관함</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              메인 유물 외에도 보관함에 여러 유물을 보관할 수 있어요. 보관 유물도 메인 효과의 약 20%가 추가 적용돼요.
            </span>
          </div>
          <div className="detail-card" style={{ borderLeft: "3px solid rgba(239,68,68,0.5)" }}>
            <strong style={{ color: "#f87171" }}>🔴 SS등급 — 신화 등급</strong><br />
            <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>
              S등급 유물 3개 이상으로 합성 가능한 최상위 등급이에요. SS 유물은 주 효과에 더해 all_bonus(+50%)까지 동시에 제공해요. 합성 최대 성공률은 46%이며 비용은 500,000P예요.
            </span>
          </div>
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">🎯 전략 팁</h2>
          {[
            { title: "나침반을 최우선으로 강화하세요", desc: "나침반은 모든 게임 포인트에 %를 더해줘요. 게임 종류에 상관없이 효과가 적용되므로 범용성이 가장 높아요." },
            { title: "보관함을 꽉 채우세요", desc: "보관함에 있는 유물도 메인 효과의 약 20%가 적용돼요. 분해하기 전에 보관함에 넣어두는 습관을 들이세요." },
            { title: "합성은 강화와 별개로 언제든 가능해요", desc: "합성은 강화 수치와 무관하게 같은 등급 유물이 충분히 모이면 바로 할 수 있어요. S·SS등급은 드롭이 되지 않고 오직 합성으로만 만들 수 있어요. SS합성은 최소 3개의 S등급 유물이 필요하고, 최대 성공률이 46%이므로 신중하게 결정하세요." },
            { title: "모래시계로 강화 비용을 줄이세요", desc: "강화를 많이 할 계획이라면 모래시계 유물을 보관함에 넣어두세요. 강화 비용이 줄어들어 더 효율적이에요." },
          ].map((t, i) => (
            <div key={i} className="detail-card">
              <strong>💡 {t.title}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>{t.desc}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">❓ 자주 묻는 질문</h2>
          {[
            { q: "유물은 어떻게 얻나요?", a: "게임에서 승리하면 확률에 따라 유물이 드롭돼요. @초능력자 유물뽑기 명령어로 포인트를 사용해 직접 뽑을 수도 있어요." },
            { q: "강화에 실패하면 유물이 사라지나요?", a: "강화 실패 시 유물이 파괴되지는 않아요. 강화 단계가 유지되거나 하락할 수 있지만 완전 소멸은 되지 않아요." },
            { q: "유물을 분해하면 포인트를 얼마나 돌려받나요?", a: "분해하면 유물 등급과 강화 수치에 따라 일부 포인트가 환급돼요. 원금의 일부이므로 신중하게 결정하세요." },
            { q: "SS등급 유물은 어떻게 만드나요?", a: "S등급 유물 3개 이상을 보관함에 모아 '유물합성 S' 명령어로 도전하세요. 최대 성공률은 46%이며 비용은 500,000P예요. SS등급은 최상위 등급으로 합성 불가예요." },
          ].map((item, i) => (
            <div key={i} className="detail-card" style={{ borderLeft: "3px solid rgba(234,179,8,0.4)" }}>
              <strong style={{ color: "#eab308" }}>Q. {item.q}</strong><br />
              <span style={{ color: "var(--muted)", fontSize: "14px", lineHeight: "1.7" }}>A. {item.a}</span>
            </div>
          ))}
        </div>

        <div className="detail-section">
          <h2 className="detail-section-h">⌨️ 명령어</h2>
          <div className="detail-cmd-list">
            {[
              { cmd: "@초능력자 내유물",     desc: "보유 유물 확인" },
              { cmd: "@초능력자 유물보관함", desc: "보관 유물 목록" },
              { cmd: "@초능력자 유물강화",   desc: "메인 유물 강화 시도" },
              { cmd: "@초능력자 유물합성",   desc: "보관 유물 합성" },
              { cmd: "@초능력자 유물분해",   desc: "유물 분해 · 포인트 환급" },
              { cmd: "@초능력자 유물뽑기",   desc: "포인트로 유물 직접 뽑기" },
            ].map((c, i) => (
              <div key={i} className="detail-cmd-row">
                <span className="detail-cmd-code">{c.cmd}</span>
                <span className="detail-cmd-desc">// {c.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DetailFooter />
    </div>
  );
}

const PAGE_META: Record<string, { title: string; desc: string }> = {
  chosung: { title: "초능력자 - 초성퀴즈",    desc: "가장 빠르게 초성을 맞춘 사람이 승리! 카카오톡 채팅방에서 친구들과 즐기는 초성 퀴즈 게임. 1인 개발 챗봇 프로젝트입니다!" },
  hunmin:  { title: "초능력자 - 훈민정음",    desc: "아는 단어를 전부 입력하세요! 많이 맞출수록 승리에 가까워지는 단어 배틀. 1인 개발 챗봇 프로젝트입니다!" },
  combo:   { title: "초능력자 - 콤보 시스템", desc: "세 게임 중 어떤 게임이든 5분 내 5번 이기면 콤보 발동! 60초간 +20% 포인트 보너스. 1인 개발 챗봇 프로젝트입니다!" },
  jamo:    { title: "초능력자 - 자모연성",    desc: "흩어진 한글 자모로 단어를 맞히는 퍼즐 게임! 쉬움·보통·어려움 난이도와 연속 정답 보너스. 1인 개발 챗봇 프로젝트입니다!" },
  relic:   { title: "초능력자 - 유물 시스템", desc: "게임 드롭으로 수집하고, D→C→B→A→S 5등급으로 강화·합성! 카카오톡 챗봇 유물 시스템 소개." },
};
const DEFAULT_TITLE = "초능력자 - 카카오톡 챗봇";
const DEFAULT_DESC  = "1인 개발 챗봇 프로젝트입니다! 모든 이용자 분께 감사의 인사를 드립니다";

/* ── Main export ── */
export default function DetailPage() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const pageMeta = mode ? PAGE_META[mode] : null;
  useOgMeta({
    title: pageMeta?.title ?? DEFAULT_TITLE,
    description: pageMeta?.desc ?? DEFAULT_DESC,
    url: mode ? `https://chosung.app/detail/${mode}` : "https://chosung.app/",
  });

  let content: ReactNode;
  switch (mode) {
    case "chosung": content = <ChosungDetail />; break;
    case "hunmin":  content = <HunminDetail />; break;
    case "combo":   content = <ComboDetail />; break;
    case "jamo":    content = <JamoDetail />; break;
    case "relic":   content = <RelicDetail />; break;
    default:
      navigate("/");
      return null;
  }

  return <>{content}</>;
}
