import { useState } from "react";

const PATCH_KEY = "patch_v29_seen";

const NEW_NOTICES = [
  { icon: "🎉", text: "초대 이벤트 진행 중! 자세한 사항은 초능력자 봇 채널을 참고해주세요." },
];

const PREV_NOTICES = [
  { icon: "🆓", text: "닉네임 변경이 무료로 바뀌었어요 — 포인트 차감 없이 언제든 변경할 수 있어요." },
  { icon: "🔮", text: "유물합성 방식이 바뀌었어요 — '유물합성 D/C/B/A'로 단계별 미리보기 후 진행해요." },
];

const CHANNEL_URL = "https://pf.kakao.com/_xdRzjX";

export default function PatchNoticeModal() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(PATCH_KEY));

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(PATCH_KEY, "1");
    setVisible(false);
  }

  return (
    <div style={S.overlay} onClick={dismiss}>
      <div style={S.box} onClick={e => e.stopPropagation()}>
        <div style={S.badge}>📢 업데이트 안내</div>

        <div style={S.sectionLabel}>5/16 적용사항</div>
        <ul style={S.list}>
          {NEW_NOTICES.map((n, i) => (
            <li key={i} style={S.item}>
              <span style={S.icon}>{n.icon}</span>
              <span style={S.text}>{n.text}</span>
            </li>
          ))}
        </ul>

        <div style={S.divider} />

        <div style={S.sectionLabel}>이전 적용사항</div>
        <ul style={{ ...S.list, marginBottom: 20 }}>
          {PREV_NOTICES.map((n, i) => (
            <li key={i} style={{ ...S.item, color: "#94a3b8" }}>
              <span style={S.icon}>{n.icon}</span>
              <span style={S.text}>{n.text}</span>
            </li>
          ))}
        </ul>

        <div style={S.btnRow}>
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={S.btnChannel}
          >
            채널로 이동
          </a>
          <button style={S.btnClose} onClick={dismiss}>닫기</button>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px",
  },
  box: {
    background: "#0f0f1e",
    border: "1px solid rgba(167,139,250,0.25)",
    borderRadius: 18,
    padding: "24px 24px 20px",
    width: "100%",
    maxWidth: 360,
    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
  },
  badge: {
    fontSize: 13, fontWeight: 700,
    color: "#a78bfa", marginBottom: 14, letterSpacing: "0.02em",
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#a78bfa",
    letterSpacing: "0.08em", textTransform: "uppercase",
    marginBottom: 10, opacity: 0.8,
  },
  divider: {
    borderTop: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 12, marginTop: 4,
  },
  list: {
    margin: 0, padding: 0, listStyle: "none",
    display: "flex", flexDirection: "column", gap: 10,
    marginBottom: 12,
  },
  item: {
    display: "flex", gap: 10, alignItems: "flex-start",
    fontSize: 14, lineHeight: 1.55, color: "#cbd5e1",
  },
  icon: { flexShrink: 0, marginTop: 1 },
  text: {},
  btnRow: {
    display: "flex", gap: 8,
  },
  btnChannel: {
    flex: 1, padding: "11px 0",
    background: "rgba(167,139,250,0.2)",
    border: "1px solid rgba(167,139,250,0.4)",
    borderRadius: 10, color: "#a78bfa",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", textDecoration: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  },
  btnClose: {
    flex: 1, padding: "11px 0",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, color: "#94a3b8",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s",
  },
};
