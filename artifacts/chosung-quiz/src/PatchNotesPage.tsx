import heroImage from "/chosung-hero3.png";
import { Link, useNavigate } from "react-router-dom";
import { useOgMeta } from "./hooks/use-og-meta";

interface Change { tag: string; tagColor: string; text: string }
interface PatchEntry {
  version: string;
  date: string;
  label: string;
  labelColor: string;
  summary: string;
  changes: Change[];
}

const PATCHES: PatchEntry[] = [
  {
    version: "v2.9",
    date: "2026년 5월 30일",
    label: "최신",
    labelColor: "#f43f5e",
    summary: "SS등급 유물 성능 대폭 강화, 합성 성공률 전반 상향",
    changes: [
      { tag: "신규", tagColor: "#f43f5e", text: "🔴 SS등급 유물 정식 출시" },
      { tag: "밸런스", tagColor: "#34d399", text: "SS등급 기본 효과값 77.52% → 95.0%으로 상향 (+22.5%)" },
      { tag: "밸런스", tagColor: "#34d399", text: "SS 이중 효과(전체 보너스) 30% → 50%로 상향" },
      { tag: "밸런스", tagColor: "#34d399", text: "SS 유물 전체 성능 약 41% 향상" },
      { tag: "밸런스", tagColor: "#34d399", text: "유물 합성 성공률 전 등급 +1%p 상향" },
      { tag: "밸런스", tagColor: "#34d399", text: "SS 합성 최대 성공률 45% → 46% 상향" },
      { tag: "밸런스", tagColor: "#34d399", text: "배틀 최대 승리 보상 100만P → 300만P 상향" },
      { tag: "시스템", tagColor: "#fb923c", text: "상대가 SS 유물 보유 시 도전자 최소 승률 하향 (메인+보관: 1%, 메인: 2%, 보관: 3%)" },
    ],
  },
  {
    version: "v2.8",
    date: "2026년 5월 12일",
    label: "개선",
    labelColor: "#60a5fa",
    summary: "훈민정음 포인트 상향, 배틀 멘션 추가, 초능력자 순위 전면화, 사이트 전반 업데이트",
    changes: [
      { tag: "밸런스", tagColor: "#34d399", text: "훈민정음 단어 보상 900P → 1,170P (×1.3배) 상향" },
      { tag: "밸런스", tagColor: "#34d399", text: "훈민정음 MVP 보너스 5,520P → 7,176P (×1.3배) 상향" },
      { tag: "개선", tagColor: "#60a5fa", text: "배틀 결과 카드 앞에 @공격자 vs @상대 멘션 텍스트 추가" },
      { tag: "개선", tagColor: "#60a5fa", text: "프로필 페이지 메인 수치를 초능력자 점수로 변경 (포인트는 하위 카드로 이동)" },
      { tag: "개선", tagColor: "#60a5fa", text: "포인트 랭킹 탭 각 항목 아래 초능력자 점수 sub line 추가" },
      { tag: "개선", tagColor: "#60a5fa", text: "메인사이트 랭킹 섹션을 초능력자 순위 기준으로 전환" },
      { tag: "개선", tagColor: "#60a5fa", text: "모든 순위 표시 기준을 초능력자 점수(포인트+유물자산+전투력)로 통일" },
    ],
  },
  {
    version: "v2.7",
    date: "2026년 5월 10일",
    label: "개선",
    labelColor: "#60a5fa",
    summary: "배틀 방어 기록 표시, 웹사이트 법적 페이지 및 패치노트 추가",
    changes: [
      { tag: "개선", tagColor: "#60a5fa", text: "배틀 전적에 방어 기록 포함 — ⚔️ 공격 / 🛡️ 방어 구분 표시" },
      { tag: "개선", tagColor: "#60a5fa", text: "배틀 통계(승/패/승률)에 공격+방어 합산 반영" },
      { tag: "개선", tagColor: "#60a5fa", text: "방어 실패 시 빼앗긴 포인트(-N P) 표시" },
      { tag: "신규", tagColor: "#0EA5E9", text: "이용약관 페이지 추가 (chosung.app/terms)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "연락처 페이지 추가 (chosung.app/contact)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "패치노트 페이지 추가 (chosung.app/patchnotes)" },
      { tag: "개선", tagColor: "#60a5fa", text: "모든 상세 페이지에 전략 팁·자주 묻는 질문(FAQ) 섹션 추가" },
    ],
  },
  {
    version: "v2.6",
    date: "2026년 5월 10일",
    label: "시스템 개편",
    labelColor: "#fb923c",
    summary: "콤보 시스템 전면 개편, 선물 한도 상향, 버그 3종 수정",
    changes: [
      { tag: "개편", tagColor: "#fb923c", text: "콤보 발동 조건 변경: 5분 내 5번 승리 시 즉시 발동" },
      { tag: "개편", tagColor: "#fb923c", text: "콤보 지속 시간: 60초 (+20% 보너스)" },
      { tag: "개편", tagColor: "#fb923c", text: "콤보는 유저 개인 독립 — 다른 사람 콤보와 간섭 없음" },
      { tag: "개편", tagColor: "#fb923c", text: "콤보 활성화 중 카운터 정지 → 만료 후 재카운트 시작" },
      { tag: "밸런스", tagColor: "#34d399", text: "선물 일일 횟수 한도: 3회 → 5회 상향" },
      { tag: "밸런스", tagColor: "#34d399", text: "선물 일일 총량 한도: 5,000P → 30,000P 상향" },
      { tag: "버그", tagColor: "#f87171", text: "자모연성 연속 정답(streak) 카운트 오류 수정" },
      { tag: "버그", tagColor: "#f87171", text: "콤보 폴백 처리 버그 수정" },
      { tag: "버그", tagColor: "#f87171", text: "유물합성 폴백 예외 처리 누락 수정" },
      { tag: "개선", tagColor: "#60a5fa", text: "랭킹 응답 메시지에 닉네임 정보 표시 개선" },
    ],
  },
  {
    version: "v2.5",
    date: "2026년 5월 9일",
    label: "기능 추가",
    labelColor: "#0EA5E9",
    summary: "밸런싱 리포트 페이지, 훈민정음 솔로 플레이, 배틀 히스토리 모달 추가",
    changes: [
      { tag: "신규", tagColor: "#0EA5E9", text: "밸런싱 리포트 페이지 추가 (chosung.app/balance) — 게임 파라미터 분석 공개" },
      { tag: "신규", tagColor: "#0EA5E9", text: "훈민정음 솔로 플레이 모드 추가 — MVP 보너스 없이 1인 연습 가능" },
      { tag: "신규", tagColor: "#0EA5E9", text: "배틀 히스토리 모달 추가 — 페이지네이션으로 전체 전적 열람 가능" },
      { tag: "개선", tagColor: "#60a5fa", text: "랭킹 페이지 유저 항목 클릭 시 프로필 페이지 연동" },
      { tag: "밸런스", tagColor: "#34d399", text: "유물 효과 전반 +2% 상향 조정" },
      { tag: "개선", tagColor: "#60a5fa", text: "게임 메시지 전반에 아이콘 추가로 가독성 향상" },
      { tag: "버그", tagColor: "#f87171", text: "자모연성 UX 버그 3종 수정 (Task #80)" },
      { tag: "개선", tagColor: "#60a5fa", text: "게임 시작 메시지 및 버튼 레이아웃 개선" },
    ],
  },
  {
    version: "v2.4",
    date: "2026년 5월 8일",
    label: "유물 개선",
    labelColor: "#eab308",
    summary: "유물 판매가 누적 비용 반영, 유물뽑기 포인트 로그 추가",
    changes: [
      { tag: "개선", tagColor: "#60a5fa", text: "유물 판매가에 강화 누적 비용 반영 — 강화할수록 판매/분해 환급액 증가 (Task #76)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "유물뽑기 차감 안내 메시지 추가 및 포인트 로그 기록 (Task #77)" },
      { tag: "버그", tagColor: "#f87171", text: "합성 실패 시 재료 반환 과정에서 보관함 초과 방지 처리 추가" },
    ],
  },
  {
    version: "v2.3",
    date: "2026년 5월 5일",
    label: "신규 기능",
    labelColor: "#0EA5E9",
    summary: "배틀 시스템 신규 도입, 퀴즈 카테고리 복원",
    changes: [
      { tag: "신규", tagColor: "#0EA5E9", text: "배틀 시스템 도입: @초능력자 배틀 [닉네임] 으로 유저 간 포인트 배틀 가능 (Task #62)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "배틀 전적·승률 프로필 웹페이지에 표시 (Task #68)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "카카오 프로필 카드에 배틀 승률 표기 (Task #69)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "일일 배틀 횟수 제한 — 원자적 처리로 중복 방지" },
      { tag: "개선", tagColor: "#60a5fa", text: "유물 합성·판매·분해 결과를 이미지 카드로 표시 (Task #53)" },
      { tag: "버그", tagColor: "#f87171", text: "삭제됐던 초성퀴즈 카테고리 전체 복원" },
      { tag: "버그", tagColor: "#f87171", text: "유물 합성 시 보관함 초과 방지 체크 추가 (Task #74)" },
    ],
  },
  {
    version: "v2.2",
    date: "2026년 5월 4일",
    label: "대규모 업데이트",
    labelColor: "#fb923c",
    summary: "플레이어 프로필 사이트 구축, 웹사이트 다크 테마 전환, 게임 상세 페이지 추가",
    changes: [
      { tag: "신규", tagColor: "#0EA5E9", text: "플레이어 프로필 페이지 구축 (chosung.app/profile) — 랭킹·포인트·출석·유물 정보 표시 (Task #40)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "웹사이트 전체 다크 테마 전환 (#070710 배경)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "게임 모드 상세 페이지 5종 추가 (초성퀴즈·훈민정음·콤보·자모연성·유물)" },
      { tag: "개선", tagColor: "#60a5fa", text: "프로필에 방 내 랭킹 표시 추가" },
      { tag: "개선", tagColor: "#60a5fa", text: "프로필에 출석 캘린더 및 유물 상세 정보 표시" },
      { tag: "개선", tagColor: "#60a5fa", text: "카카오 봇 프로필 카드에 유물 정보 표시 (Task #11)" },
      { tag: "개선", tagColor: "#60a5fa", text: "A100 ML 파라미터 v3.2 적용 — 게임 보상 밸런스 최적화" },
    ],
  },
  {
    version: "v2.1",
    date: "2026년 5월 3일",
    label: "UX 개선",
    labelColor: "#60a5fa",
    summary: "자모연성 UX 5종 개선, 유물 UI 전반 정리",
    changes: [
      { tag: "개선", tagColor: "#60a5fa", text: "자모연성 UX 5종 개선 — 입력 흐름, 정답 피드백, 포기 처리 (Task #24)" },
      { tag: "개선", tagColor: "#60a5fa", text: "내 유물 표시 형식 및 효과 설명 간략화 (Task #27)" },
      { tag: "개선", tagColor: "#60a5fa", text: "유물 보관함 목록 표시 형식 통일 (Task #28)" },
      { tag: "개선", tagColor: "#60a5fa", text: "강화 안내 카드에 현재 유물 정보 함께 표시 (Task #32)" },
      { tag: "개선", tagColor: "#60a5fa", text: "합성 안내 카드에 현재 유물 효과 수치 표시 (Task #33)" },
      { tag: "개선", tagColor: "#60a5fa", text: "합성 성공률 미리보기 카드에 재료 유물 효과 수치 표시 (Task #34)" },
      { tag: "개선", tagColor: "#60a5fa", text: "프로필에 마지막 자모연성 날짜 표시 추가" },
      { tag: "밸런스", tagColor: "#34d399", text: "유물 강화 비용에 할인 적용" },
    ],
  },
  {
    version: "v2.0",
    date: "2026년 5월 2일",
    label: "대규모 개편",
    labelColor: "#fb923c",
    summary: "유물 시스템 대개편 (D~S 5등급), 자모연성 게임 추가, 서브게임 제거",
    changes: [
      { tag: "개편", tagColor: "#fb923c", text: "서브게임(운명홀짝·하이로우) 및 도전권 시스템 전면 제거" },
      { tag: "신규", tagColor: "#0EA5E9", text: "자모연성 게임 추가 — 한글 자모 4지선다 퍼즐 (쉬움·보통·어려움)" },
      { tag: "개편", tagColor: "#fb923c", text: "유물 등급 체계 전면 개편: D → C → B → A → S 5단계" },
      { tag: "개편", tagColor: "#fb923c", text: "유물 강화 최대 +20강으로 설정, 합성은 강화 수치와 별개로 언제든 가능 (Task #9)" },
      { tag: "개편", tagColor: "#fb923c", text: "유물뽑기: D등급 고정 드롭, 보관함 8칸 (Task #18)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "유물 합성 시스템: 재료 자유화 + 확률제 합성 + 포인트 비용 (Task #19~21)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "합성 전 성공률 미리보기 명령어 추가 (Task #23)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "유물확률 명령어 추가 — 뽑기 확률표 공개" },
      { tag: "신규", tagColor: "#0EA5E9", text: "콤보 보너스 시스템 도입 — 연속 승리 시 포인트 보너스" },
      { tag: "버그", tagColor: "#f87171", text: "카카오 텍스트카드 버튼 3개 초과 문제 전체 수정 (Task #16)" },
    ],
  },
  {
    version: "v1.2",
    date: "2026년 4월 30일",
    label: "신규 기능",
    labelColor: "#0EA5E9",
    summary: "유물 시스템 최초 도입",
    changes: [
      { tag: "신규", tagColor: "#0EA5E9", text: "유물 시스템 최초 도입 — 게임 승리 시 유물 드롭, 보관·사용 가능" },
      { tag: "신규", tagColor: "#0EA5E9", text: "유물 이미지 카탈로그 및 구조화된 유물 데이터 추가" },
    ],
  },
  {
    version: "v1.1",
    date: "2026년 4월 21일",
    label: "정책 추가",
    labelColor: "#94a3b8",
    summary: "개인정보처리방침 페이지 추가, 연락처 카드 추가",
    changes: [
      { tag: "신규", tagColor: "#0EA5E9", text: "개인정보처리방침 페이지 추가 (chosung.app/policy)" },
      { tag: "신규", tagColor: "#0EA5E9", text: "카카오 오픈채팅 연락처 카드 추가 — 개인 오픈프로필·공식 채팅방" },
      { tag: "개선", tagColor: "#60a5fa", text: "게임 종료 메시지에 정답 표시 추가" },
    ],
  },
  {
    version: "v1.0",
    date: "2026년 4월 20일",
    label: "첫 출시",
    labelColor: "#34d399",
    summary: "초능력자 봇 및 웹사이트 최초 출시",
    changes: [
      { tag: "출시", tagColor: "#34d399", text: "초성퀴즈 게임 출시 — 4,900+ 문제, 다양한 카테고리, 힌트 기능(20P)" },
      { tag: "출시", tagColor: "#34d399", text: "훈민정음 게임 출시 — 75,221개 한국어 사전, 복수 정답 인정, 참여자 등록제" },
      { tag: "출시", tagColor: "#34d399", text: "초능력포인트(P) 시스템 — 게임 승리 시 포인트 적립" },
      { tag: "출시", tagColor: "#34d399", text: "출석 체크 시스템 — 매일 출석 시 보상 지급" },
      { tag: "출시", tagColor: "#34d399", text: "선물 기능 — 다른 유저에게 포인트 선물" },
      { tag: "출시", tagColor: "#34d399", text: "랭킹 시스템 — 방 내 순위 + 서버 전체 순위" },
      { tag: "출시", tagColor: "#34d399", text: "게임 세션 타임아웃 및 동시 진행 방지" },
      { tag: "출시", tagColor: "#34d399", text: "웹사이트 최초 버전 (chosung.app) — 마스코트, 랭킹 미리보기, 채팅방 초대 버튼" },
    ],
  },
];

const TAG_COLORS: Record<string, string> = {
  "출시": "#34d399", "신규": "#0EA5E9", "개편": "#fb923c",
  "밸런스": "#34d399", "개선": "#60a5fa", "버그": "#f87171",
};

export default function PatchNotesPage() {
  const navigate = useNavigate();
  useOgMeta({
    title: "초능력자 - 패치노트",
    description: "초능력자 카카오톡 챗봇 업데이트 기록. 신규 기능, 밸런스 조정, 버그 수정 내역을 확인하세요.",
    url: "https://chosung.app/patchnotes",
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
          <div className="eyebrow">업데이트 기록</div>
          <h1 className="policy-title">패치노트</h1>
          <p className="policy-effective">초능력자 봇의 모든 업데이트 내역 — v1.0 (2026.04.20) ~ 현재</p>
        </div>

        <div className="policy-container" style={{ maxWidth: 720 }}>

          {/* 태그 범례 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
            {Object.entries(TAG_COLORS).map(([tag, color]) => (
              <span key={tag} style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: color + "18", color, border: `1px solid ${color}40`,
              }}>{tag}</span>
            ))}
          </div>

          {PATCHES.map((patch, pi) => (
            <div key={pi} style={{
              marginBottom: 28,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              overflow: "hidden",
            }}>
              {/* 헤더 */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.03)",
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.5px" }}>
                  {patch.version}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: patch.labelColor + "20", color: patch.labelColor,
                  border: `1px solid ${patch.labelColor}40`,
                }}>{patch.label}</span>
                <span style={{ fontSize: 12, color: "#64748b", marginLeft: "auto" }}>{patch.date}</span>
              </div>

              {/* 요약 */}
              <div style={{ padding: "10px 20px 4px", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                {patch.summary}
              </div>

              {/* 변경 사항 목록 */}
              <div style={{ padding: "8px 20px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
                {patch.changes.map((c, ci) => (
                  <div key={ci} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, flexShrink: 0, marginTop: 2,
                      background: c.tagColor + "18", color: c.tagColor, border: `1px solid ${c.tagColor}30`,
                      minWidth: 38, textAlign: "center",
                    }}>{c.tag}</span>
                    <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6 }}>{c.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="policy-footer-note">
            패치노트는 주요 업데이트 기준으로 작성됩니다. 소규모 수정은 별도 공지 없이 반영될 수 있어요.
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
