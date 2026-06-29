import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import heroImage from "/chosung-hero3.png";
import { useOgMeta } from "./hooks/use-og-meta";

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="bal-lightbox-overlay" onClick={onClose}>
      <img
        src={src}
        alt="확대 이미지"
        className="bal-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
      <button className="bal-lightbox-close" onClick={onClose}>✕</button>
    </div>
  );
}

function Nav() {
  const navigate = useNavigate();
  return (
    <nav className="nav">
      <div className="nav-logo" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
        <img src={heroImage} alt="" />
        <span>초능력자</span>
      </div>
      <div className="nav-links">
        <button onClick={() => navigate("/")}>홈</button>
        <button onClick={() => navigate("/detail/relic")}>🏛️ 유물</button>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <img src={heroImage} alt="초능력자" className="footer-img" />
      <p className="footer-name">초능력자</p>
      <p className="footer-sub">© 2026 혁도동. All rights reserved. Made with 💜</p>
      <div className="footer-links">
        <Link to="/policy" className="footer-policy-link">개인정보처리방침</Link>
        <Link to="/balance" className="footer-policy-link">밸런싱 리포트</Link>
        <a href="https://open.kakao.com/o/pqOPQEsi" target="_blank" rel="noopener noreferrer" className="footer-policy-link">문의</a>
      </div>
    </footer>
  );
}

const SEGMENT_DATA = [
  { name: "inactive", label: "비활성",   count: 2255, color: "#475569" },
  { name: "low",      label: "저활동",   count: 2704, color: "#64748b" },
  { name: "mid",      label: "중간",     count: 3170, color: "#0369A1" },
  { name: "high",     label: "고활동",   count:  600, color: "#0c4a6e" },
  { name: "whale",    label: "열성",     count:   97, color: "#0c4a6e" },
  { name: "ultra",    label: "초열성",   count:    6, color: "#0EA5E9" },
];

const BEST = {
  metrics: {
    reach_d5: 50.2,
    reach_d10: 4.3,
    has_A: 3.2,
    has_S: 0,
    sink_ratio: 85.5,
    p99_p50: 9.29,
    drop7: 28.5,
    mean_bonus: 4.5,
    p99_bonus: 24.4,
  },
};

function SegmentBar() {
  const total = 6945;
  return (
    <div className="bal-seg-wrap">
      <div className="bal-seg-bar">
        {SEGMENT_DATA.map((s) => (
          <div
            key={s.name}
            className="bal-seg-slice"
            style={{ flex: s.count / total, background: s.color, minWidth: s.count < 50 ? "4px" : undefined }}
            title={`${s.label}: ${s.count.toLocaleString()}명`}
          />
        ))}
      </div>
      <div className="bal-seg-legend">
        {SEGMENT_DATA.map((s) => (
          <div key={s.name} className="bal-seg-item">
            <span className="bal-seg-dot" style={{ background: s.color }} />
            <span className="bal-seg-name">{s.label}</span>
            <span className="bal-seg-cnt">{s.count.toLocaleString()}명</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricGauge({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="bal-gauge">
      <div className="bal-gauge-label">{label}</div>
      <div className="bal-gauge-track">
        <div className="bal-gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="bal-gauge-val">{value}{unit}</div>
    </div>
  );
}

function DropRateBar() {
  const drops = [
    { grade: "D", value: 4.41, color: "#94a3b8" },
    { grade: "C", value: 3.50, color: "#4ade80" },
    { grade: "B", value: 0.48, color: "#60a5fa" },
    { grade: "A", value: 0.083, color: "#0EA5E9" },
    { grade: "S", value: 0, color: "#fbbf24" },
  ];
  const max = 5;
  return (
    <div className="bal-drop-wrap">
      {drops.map((d) => (
        <div key={d.grade} className="bal-drop-row">
          <span className="bal-drop-grade" style={{ color: d.color }}>{d.grade}</span>
          <div className="bal-drop-track">
            <div
              className="bal-drop-fill"
              style={{
                width: `${Math.max((d.value / max) * 100, d.value > 0 ? 1 : 0)}%`,
                background: d.color,
              }}
            />
          </div>
          <span className="bal-drop-pct">{d.value > 0 ? `${d.value}%` : "합성으로만 획득"}</span>
        </div>
      ))}
    </div>
  );
}

export default function BalancePage() {
  useOgMeta({
    title: "초능력자 - 밸런스 현황",
    description: "초능력자 카카오톡 챗봇 포인트 획득량·유물 강화 성공률 등 밸런스 데이터를 확인하세요.",
    url: "https://chosung.app/balance",
  });
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <div className="detail-page">
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      <Nav />

      {/* Hero */}
      <div className="detail-hero" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)" }}>
        <div className="detail-hero-icon">⚖️</div>
        <div className="detail-hero-tag" style={{ background: "rgba(3,105,161,0.18)", color: "#0EA5E9", border: "1px solid rgba(3,105,161,0.3)" }}>
          AI · GPU 밸런싱 분석
        </div>
        <h1 className="detail-hero-title">유물 시스템 밸런싱 리포트</h1>
        <p className="detail-hero-sub">
          실제 유저 6,945명의 데이터를 바탕으로 GPU 시뮬레이션을 돌려<br />
          유물 시스템이 얼마나 공정하고 재미있는지 수치로 검증했습니다.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "8px" }}>
          {[
            { icon: "🖥️", text: "NVIDIA A100 GPU 사용" },
            { icon: "👥", text: "유저 6,945명 데이터" },
            { icon: "🔬", text: "8,192가지 설정 비교" },
          ].map(b => (
            <span key={b.text} style={{ background: "rgba(3,105,161,0.12)", border: "1px solid rgba(3,105,161,0.2)", borderRadius: "8px", padding: "6px 14px", fontSize: "13px", color: "#38BDF8" }}>
              {b.icon} {b.text}
            </span>
          ))}
        </div>
      </div>

      <div className="detail-body">
        <button className="detail-back-btn" onClick={() => window.history.back()}>← 돌아가기</button>

        {/* ── 1. 분석 배경 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">🎯 왜 분석했나요?</h2>
          <p style={{ color: "var(--ink)", lineHeight: "1.8", marginBottom: "16px" }}>
            유물 시스템은 게임에서 이길 때 가끔 드랍되는 아이템을 강화·합성해서
            포인트를 더 많이 받는 수집 콘텐츠입니다.
            드랍 확률, 강화 비용, 합성 성공률 같은 <strong>17가지 수치</strong>를
            어떻게 설정하느냐에 따라 유저가 느끼는 재미가 완전히 달라집니다.
            너무 쉬우면 S급이 흔해지고, 너무 어려우면 아무도 도전하지 않습니다.
          </p>
          <div className="bal-goal-grid">
            {[
              { icon: "📈", title: "꾸준한 성장감",   desc: "강화가 너무 쉽지도, 너무 어렵지도 않아서 매일 조금씩 성장하는 느낌을 줍니다." },
              { icon: "⚖️", title: "적절한 희귀성",   desc: "A·S급 유물이 가끔 보여서 수집 의욕이 생기고, 흔해서 가치가 사라지지 않도록 합니다." },
              { icon: "💰", title: "포인트 균형",      desc: "유저들이 버는 포인트와 쓰는 포인트의 비율이 경제적으로 건전하게 유지됩니다." },
              { icon: "🎮", title: "체감 보너스",      desc: "유물 효과가 너무 미미하거나 너무 압도적이지 않고, 게임에서 실제로 도움이 됩니다." },
            ].map((g) => (
              <div key={g.title} className="bal-goal-card">
                <div className="bal-goal-icon">{g.icon}</div>
                <div className="bal-goal-title">{g.title}</div>
                <div className="bal-goal-desc">{g.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. 데이터 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">📊 어떤 데이터를 썼나요?</h2>

          <div className="bal-data-stats">
            {[
              { label: "전체 유저",   value: "6,945명",    icon: "👥" },
              { label: "게임 참여자", value: "4,690명",    icon: "✅" },
              { label: "총 정답 수",  value: "57,073회",   icon: "⚡" },
              { label: "총 시도 수",  value: "169,928회",  icon: "🎮" },
            ].map((s) => (
              <div key={s.label} className="bal-data-stat">
                <div className="bal-data-stat-icon">{s.icon}</div>
                <div className="bal-data-stat-val">{s.value}</div>
                <div className="bal-data-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <h3 className="bal-sub-h">유저 활동 등급 분포</h3>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px", lineHeight: "1.7" }}>
            포인트·정답 수·최근 접속 여부를 종합해 유저를 6단계로 나눴습니다.
            활동량이 높을수록 유물에 포인트를 더 많이 투자하는 경향이 있어,
            시뮬레이션에서 각 그룹의 행동 패턴을 따로 반영했습니다.
          </p>
          <SegmentBar />

          <div className="bal-note" style={{ marginTop: "16px" }}>
            <strong>데이터 보정 방법</strong><br />
            수집한 랭킹 데이터에는 일부 유저만 포함돼 있었습니다.
            전체 유저의 포인트 분포(구간별 비율)를 참고해
            빠진 유저들을 통계적으로 복원한 뒤, 6,945명 전체 데이터로 분석을 진행했습니다.
          </div>
        </div>

        {/* ── 3. 분석 방법 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">🔬 어떻게 분석했나요?</h2>
          <p style={{ color: "var(--ink)", lineHeight: "1.8", marginBottom: "20px" }}>
            분석은 3단계로 이뤄집니다. 각 단계의 결과가 다음 단계의 재료가 됩니다.
          </p>

          <div className="bal-pipeline">
            <div className="bal-stage">
              <div className="bal-stage-num">1</div>
              <div className="bal-stage-body">
                <div className="bal-stage-title">유저별 게임 활동량 예측</div>
                <div className="bal-stage-file">사용 기법: Zero-Inflated Negative Binomial(ZINB) 패널 모델</div>
                <p className="bal-stage-desc">
                  일별 이벤트 기록이 없어도 누적 데이터만으로 유저가 하루에 퀴즈를 몇 번 맞히는지 예측합니다.
                  아예 게임을 안 하는 날과 열심히 하는 날을 동시에 설명할 수 있는 통계 모델을
                  A100 GPU에서 학습시켰습니다.
                </p>
                <div className="bal-stage-tags">
                  <span>ZINB 패널 모델</span>
                  <span>PyTorch A100</span>
                  <span>300 에폭 학습</span>
                </div>
              </div>
            </div>
            <div className="bal-pipeline-arrow">↓</div>

            <div className="bal-stage">
              <div className="bal-stage-num">2</div>
              <div className="bal-stage-body">
                <div className="bal-stage-title">8,192가지 설정으로 180일 시뮬레이션</div>
                <div className="bal-stage-file">사용 기법: Sobol/QMC 샘플링 + CEM 변분추론</div>
                <p className="bal-stage-desc">
                  유물 드랍 확률, 강화 비용 등 17가지 수치를 조금씩 다르게 설정한
                  8,192가지 조합을 만들어, 유저 6,945명이 180일 동안 플레이하면
                  어떻게 되는지 GPU로 한꺼번에 시뮬레이션했습니다.
                  결과가 좋은 설정들을 추려서 다시 정밀하게 탐색하는 과정을 반복합니다.
                </p>
                <div className="bal-stage-tags">
                  <span>Sobol/QMC 샘플링</span>
                  <span>180일 시뮬레이션</span>
                  <span>CEM 반복 정제</span>
                </div>
              </div>
            </div>
            <div className="bal-pipeline-arrow">↓</div>

            <div className="bal-stage">
              <div className="bal-stage-num">3</div>
              <div className="bal-stage-body">
                <div className="bal-stage-title">4가지 목표를 동시에 만족하는 최적 설정 선정</div>
                <div className="bal-stage-file">사용 기법: Pareto Ranking + 서로게이트 모델(PCA/PLS 차원 압축)</div>
                <p className="bal-stage-desc">
                  성장감·희귀성·경제 균형·체감 보너스 4가지 목표를 동시에 잘 만족하는
                  설정을 고르기 위해 파레토 랭킹 기법을 사용합니다.
                  어느 하나만 좋은 게 아니라 전부 적당히 좋은 설정을 우선순위에 두고,
                  서로게이트 모델로 마지막 정밀 조정을 거쳐 최종 후보를 확정합니다.
                </p>
                <div className="bal-stage-tags">
                  <span>Pareto Ranking</span>
                  <span>PCA/PLS 차원 압축</span>
                  <span>서로게이트 정제</span>
                  <span>v3.6</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. 평가 지표 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">📐 무엇을 기준으로 평가했나요?</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px", lineHeight: "1.7" }}>
            180일 뒤 유저들이 어떤 상태가 됐는지를 아래 8가지 수치로 측정했습니다.
          </p>
          <div className="bal-metric-grid">
            {[
              {
                label: "강화 +5 도달률",
                desc: "180일 안에 유물을 +5강까지 올린 유저 비율. 너무 낮으면 성장이 막막하고, 너무 높으면 목표가 사라집니다.",
              },
              {
                label: "강화 +10 도달률",
                desc: "180일 안에 +10강까지 올린 유저 비율. 열심히 하는 유저를 위한 장기 목표 지표입니다.",
              },
              {
                label: "A급 유물 보유율",
                desc: "180일 후 A등급 이상 유물을 가진 유저 비율. 너무 흔하면 희귀성이 없고, 너무 드물면 그림의 떡이 됩니다.",
              },
              {
                label: "포인트 소비율",
                desc: "유저가 버는 포인트 중 강화·합성에 쓰는 비율. 85% 정도면 경제가 건전하게 순환하는 수준입니다.",
              },
              {
                label: "상위·하위 격차",
                desc: "상위 1% 유저와 중간 유저의 포인트 배율. 격차가 너무 크면 신규 유저가 박탈감을 느낍니다.",
              },
              {
                label: "주간 드랍 경험률",
                desc: "1주일에 한 번이라도 유물을 드랍 받은 유저 비율. 이 수치가 낮으면 유물 시스템이 있는지도 모릅니다.",
              },
              {
                label: "평균 유물 보너스",
                desc: "유물 효과로 포인트가 평균 몇 % 더 늘어나는지. 유물을 키울 이유가 있는지 보여주는 지표입니다.",
              },
              {
                label: "종합 밸런싱 점수",
                desc: "위 지표들을 종합해 얼마나 균형 잡혔는지 나타내는 점수입니다. 낮을수록 밸런스가 좋습니다.",
              },
            ].map((m) => (
              <div key={m.label} className="bal-metric-card">
                <div className="bal-metric-key">{m.label}</div>
                <div className="bal-metric-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. 최적 후보 결과 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">🏆 최종 선택된 설정</h2>
          <div className="bal-best-header">
            <div>
              <div className="bal-best-id">후보 #153</div>
              <div className="bal-best-stage">서로게이트 정제 최종 후보</div>
            </div>
            <div className="bal-best-score-wrap">
              <div className="bal-best-score-label">종합 밸런싱 점수</div>
              <div className="bal-best-score-val">0.768</div>
              <div className="bal-best-loss">오차: 0.3024 (낮을수록 좋음)</div>
            </div>
          </div>

          <h3 className="bal-sub-h">이 설정으로 180일 후 예상 결과</h3>
          <div className="bal-metrics-wrap">
            <MetricGauge label="강화 +5 도달률"    value={BEST.metrics.reach_d5}    max={100} unit="%" color="#0EA5E9" />
            <MetricGauge label="강화 +10 도달률"   value={BEST.metrics.reach_d10}   max={100} unit="%" color="#0369A1" />
            <MetricGauge label="A급 이상 보유율"   value={BEST.metrics.has_A}       max={50}  unit="%" color="#38BDF8" />
            <MetricGauge label="포인트 소비율"     value={BEST.metrics.sink_ratio}  max={100} unit="%" color="#0c4a6e" />
            <MetricGauge label="주간 드랍 경험률"  value={BEST.metrics.drop7}       max={100} unit="%" color="#0EA5E9" />
            <MetricGauge label="평균 유물 보너스"  value={BEST.metrics.mean_bonus}  max={20}  unit="%" color="#0EA5E9" />
          </div>

          <div className="bal-kpi-row">
            <div className="bal-kpi">
              <div className="bal-kpi-val">{BEST.metrics.p99_p50.toFixed(2)}×</div>
              <div className="bal-kpi-label">상위·하위 격차</div>
              <div className="bal-kpi-note">상위 1% : 중간 유저 포인트 배율</div>
            </div>
            <div className="bal-kpi">
              <div className="bal-kpi-val">{BEST.metrics.p99_bonus.toFixed(1)}%</div>
              <div className="bal-kpi-label">최상위 유저 보너스</div>
              <div className="bal-kpi-note">유물 효과 최대치</div>
            </div>
            <div className="bal-kpi">
              <div className="bal-kpi-val">합성 전용</div>
              <div className="bal-kpi-label">S급 획득 방법</div>
              <div className="bal-kpi-note">직접 드랍 없음 · 합성으로만 제작</div>
            </div>
          </div>
        </div>

        {/* ── 6. 드랍 확률 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">🎲 등급별 드랍 확률</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px", lineHeight: "1.7" }}>
            게임에서 이겼을 때 각 등급 유물이 나올 확률입니다.
            S등급은 직접 드랍되지 않고 낮은 등급 유물을 합성해서만 만들 수 있습니다.
          </p>
          <DropRateBar />
          <div className="bal-note" style={{ marginTop: "16px" }}>
            <strong>이렇게 설계한 이유</strong>: D등급이 가장 자주 나와서 유저들이 유물 드랍을 일주일에 한 번 이상 경험하도록 했습니다.
            C→B→A로 갈수록 급격히 희귀해져서, 높은 등급을 목표로 계속 플레이할 이유가 생깁니다.
          </div>
        </div>

        {/* ── 7. 적용 수치 전체 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">⚙️ 결정된 수치 전체 목록</h2>
          <div className="bal-param-table">
            <div className="bal-param-header">
              <span>항목</span>
              <span>적용 값</span>
              <span>의미</span>
            </div>
            {[
              { name: "게임 승리 기본 보상",      val: "1,081 P",  desc: "퀴즈에서 이겼을 때 받는 기본 포인트 기준값" },
              { name: "활동량 보정",               val: "×0.947",   desc: "자주 하는 유저에게 보상을 살짝 줄여 과도한 쏠림 방지" },
              { name: "강화 시작 비용",             val: "800 P",    desc: "+1강을 시도하는 데 드는 기본 포인트" },
              { name: "강화 비용 증가폭",           val: "1.47배",   desc: "강화 단계가 올라갈수록 비용이 곱해지는 배율" },
              { name: "강화 성공 확률 조정",        val: "×1.10",    desc: "기본 성공률에 곱해지는 보정값 (1 이상이면 성공률 상향)" },
              { name: "레벨업 기본 비용",           val: "157 P",    desc: "레벨을 1 올리는 데 드는 기본 포인트" },
              { name: "D등급 드랍 확률",            val: "4.412%",   desc: "게임 1회 승리 시 D급 유물이 나올 확률" },
              { name: "C등급 드랍 확률",            val: "3.500%",   desc: "게임 1회 승리 시 C급 유물이 나올 확률" },
              { name: "B등급 드랍 확률",            val: "0.479%",   desc: "게임 1회 승리 시 B급 유물이 나올 확률" },
              { name: "A등급 드랍 확률",            val: "0.083%",   desc: "게임 1회 승리 시 A급 유물이 나올 확률 (매우 희귀)" },
              { name: "합성 비용 배율",             val: "×1.43",    desc: "유물 합성 시 드는 포인트 배율" },
              { name: "합성 성공 확률 조정",        val: "×0.90",    desc: "합성 기본 성공률에 곱해지는 보정값 (1 미만이면 하향)" },
              { name: "유물 효과 강도",             val: "×1.09",    desc: "유물이 주는 포인트 보너스 효과의 전체 배율" },
              { name: "저활동 유저 소비 성향",      val: "11.6%",    desc: "저활동 유저가 버는 포인트 중 유물에 쓰는 비율" },
              { name: "중간 유저 소비 성향",        val: "22.9%",    desc: "중간 활동 유저의 포인트 소비 비율" },
              { name: "고활동 유저 소비 성향",      val: "64.7%",    desc: "고활동 유저의 포인트 소비 비율" },
              { name: "열성 유저 소비 성향",        val: "61.9%",    desc: "최상위 열성 유저의 포인트 소비 비율" },
            ].map((p) => (
              <div key={p.name} className="bal-param-row">
                <span className="bal-param-key">{p.name}</span>
                <span className="bal-param-val">{p.val}</span>
                <span className="bal-param-desc">{p.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 8. 후보 비교 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">📋 상위 후보 10개 비교</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px", lineHeight: "1.7" }}>
            최종 정제 후 살아남은 상위 10개 후보를 비교한 표입니다.
            밸런싱 점수가 낮을수록 4가지 목표를 골고루 잘 만족합니다.
          </p>
          <div className="bal-cand-table">
            <div className="bal-cand-header">
              <span>후보</span>
              <span>밸런싱 점수</span>
              <span>+5 도달</span>
              <span>A급 보유</span>
              <span>소비율</span>
              <span>상하위 격차</span>
            </div>
            {[
              { id: "10000153", loss: 0.3024, d5: 50.2, hasA: 3.2,  sink: 85.5, ratio: 9.29,  best: true },
              { id: "10000060", loss: 0.3158, d5: 50.3, hasA: 5.0,  sink: 85.3, ratio: 8.15,  best: false },
              { id: "10000010", loss: 0.3168, d5: 49.8, hasA: 14.3, sink: 84.9, ratio: 11.56, best: false },
              { id: "10000141", loss: 0.3299, d5: 50.2, hasA: 8.6,  sink: 84.5, ratio: 10.94, best: false },
              { id: "10000006", loss: 0.3313, d5: 50.6, hasA: 16.0, sink: 85.9, ratio: 10.91, best: false },
              { id: "10000005", loss: 0.3337, d5: 50.4, hasA: 22.0, sink: 86.0, ratio: 11.81, best: false },
              { id: "10000039", loss: 0.3368, d5: 50.2, hasA: 8.3,  sink: 85.8, ratio: 14.61, best: false },
              { id: "10000003", loss: 0.3379, d5: 51.6, hasA: 21.2, sink: 85.0, ratio: 10.63, best: false },
              { id: "10000187", loss: 0.3462, d5: 49.5, hasA: 23.2, sink: 84.3, ratio: 14.29, best: false },
              { id: "10000000", loss: 0.3564, d5: 49.3, hasA: 24.3, sink: 86.9, ratio: 12.42, best: false },
            ].map((c) => (
              <div key={c.id} className={`bal-cand-row${c.best ? " bal-cand-best" : ""}`}>
                <span className="bal-cand-id">{c.best && "★ "}#{c.id.slice(-4)}</span>
                <span className={c.best ? "bal-val-good" : ""}>{c.loss.toFixed(4)}</span>
                <span>{c.d5.toFixed(1)}%</span>
                <span>{c.hasA.toFixed(1)}%</span>
                <span>{c.sink.toFixed(1)}%</span>
                <span>{c.ratio.toFixed(2)}×</span>
              </div>
            ))}
          </div>
          <div className="bal-note" style={{ marginTop: "16px" }}>
            <strong>#153을 선택한 이유</strong>: 밸런싱 점수가 8,192개 중 가장 낮습니다.
            절반 정도의 유저가 180일 안에 +5강에 도달할 수 있고,
            A급 유물 보유율은 3.2%로 희귀성을 유지하며,
            상위·하위 유저 간 격차도 9.3배로 과도하지 않습니다.
          </div>
        </div>

        {/* ── 9. 참고 화면 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">📸 분석 화면</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
            실제 분석 노트북에서 확인한 결과 화면입니다. 클릭하면 크게 볼 수 있습니다.
          </p>
          <div className="bal-img-grid">
            <div className="bal-img-card" onClick={() => setLightbox("/balance_img1.png")}>
              <img src="/balance_img1.png" alt="밸런싱 지표 산점도" style={{ width: "100%", borderRadius: "10px", display: "block" }} />
              <div className="bal-img-caption">밸런싱 점수(가로축)와 각 평가 지표(세로축)의 관계를 나타낸 산점도 — 상위 후보 데이터 테이블 포함</div>
            </div>
            <div className="bal-img-card" onClick={() => setLightbox("/balance_img2.png")}>
              <img src="/balance_img2.png" alt="최종 후보 파라미터 추출 코드" style={{ width: "100%", borderRadius: "10px", display: "block" }} />
              <div className="bal-img-caption">최종 후보를 선정하고 파라미터를 추출하는 분석 코드와 결과 테이블</div>
            </div>
          </div>
        </div>

        {/* ── 10. 노트북 정보 ── */}
        <div className="detail-section">
          <h2 className="detail-section-h">🗂️ 사용된 분석 코드</h2>
          <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "16px" }}>
            이번 분석은 세 개의 Python 노트북으로 이루어졌습니다.
          </p>
          <div className="bal-notebook-list">
            {[
              {
                name: "artifact_balance_a100_colab",
                role: "메인 밸런싱 분석",
                desc: "유저 데이터 파싱, ZINB 통계 모델 학습, GPU 경제 시뮬레이션, Sobol/QMC 파라미터 탐색, Pareto 랭킹 및 서로게이트 정제를 한 곳에서 수행합니다. 최종 후보 목록도 여기서 출력됩니다.",
                tags: ["ZINB 모델", "Sobol/QMC 탐색", "Pareto 랭킹", "서로게이트 정제"],
              },
              {
                name: "chaoneung_param_lab_a100_v36",
                role: "파라미터 실험실 v3.6",
                desc: "6,945명 데이터를 6개 활동 등급으로 분류하고, PCA/PLS 차원 압축 기법으로 탐색 공간을 줄여 더 정밀하게 최적 파라미터를 찾습니다.",
                tags: ["6개 등급 분류", "PCA/PLS 차원 압축", "3단계 탐색"],
              },
              {
                name: "기댓값_v3_CEM_GPU",
                desc: "CEM(Cross-Entropy Method) 기법으로 좋은 파라미터가 분포하는 영역을 반복적으로 좁혀가며 수렴 여부를 검증합니다.",
                role: "파라미터 수렴 검증",
                tags: ["CEM 반복 정제", "GPU 병렬화", "수렴 검증"],
              },
            ].map((nb) => (
              <div key={nb.name} className="bal-notebook-card">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <div className="bal-notebook-name">📓 {nb.name}</div>
                  <span style={{ fontSize: "12px", background: "rgba(3,105,161,0.15)", borderRadius: "20px", padding: "2px 10px", color: "#38BDF8" }}>{nb.role}</span>
                </div>
                <div className="bal-notebook-desc">{nb.desc}</div>
                <div className="bal-notebook-tags">
                  {nb.tags.map((t) => <span key={t}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
