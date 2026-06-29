import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST     = path.resolve(__dirname, "dist/public");
const PORT     = parseInt(process.env.PORT ?? "21490", 10);
const API_BASE = "http://localhost:8080";

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
  ".html":  "text/html; charset=utf-8",
  ".js":    "application/javascript",
  ".mjs":   "application/javascript",
  ".css":   "text/css",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".webp":  "image/webp",
  ".svg":   "image/svg+xml",
  ".ico":   "image/x-icon",
  ".json":  "application/json",
  ".woff":  "font/woff",
  ".woff2": "font/woff2",
  ".ttf":   "font/ttf",
  ".txt":   "text/plain",
  ".xml":   "application/xml",
  ".map":   "application/json",
};

// ── Crawler detection ─────────────────────────────────────────────────────────
const CRAWLER_UA =
  /kakaotalk-scrap|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|googlebot|bingbot/i;

// ── OG data ───────────────────────────────────────────────────────────────────
const BASE  = "https://chosung.app";
const RANK  = "https://rank.chosung.app";
const IMAGE = `${BASE}/chosung-og.png`;

const DEFAULT_OG = {
  title:       "초능력자 - 카카오톡 챗봇",
  description: "카카오톡 채팅방에서 바로 즐기는 한글 단어 게임 챗봇. 다양한 한글 게임으로 포인트를 모으고 유물을 성장시키며 랭킹에 도전해 보세요!",
  url:         `${BASE}/`,
};

const STATIC_MAP = {
  "/":               DEFAULT_OG,
  "/detail/chosung": { title: "초능력자 - 초성퀴즈",    description: "가장 빠르게 초성을 맞춘 사람이 승리! 카카오톡 채팅방에서 친구들과 즐기는 초성 퀴즈 게임. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/chosung` },
  "/detail/hunmin":  { title: "초능력자 - 훈민정음",    description: "아는 단어를 전부 입력하세요! 많이 맞출수록 승리에 가까워지는 단어 배틀. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/hunmin` },
  "/detail/combo":   { title: "초능력자 - 콤보 시스템", description: "세 게임 중 어떤 게임이든 10분 내 5번 이기면 콤보 발동! 60초간 +20% 포인트 보너스. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/combo` },
  "/detail/jamo":    { title: "초능력자 - 자모연성",    description: "흩어진 한글 자모로 단어를 맞히는 퍼즐 게임! 쉬움·보통·어려움 난이도와 연속 정답 보너스. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/jamo` },
  "/detail/relic":   { title: "초능력자 - 유물 시스템", description: "게임 드롭으로 수집하고, D→C→B→A→S 5등급으로 강화·합성! 카카오톡 챗봇 유물 시스템 소개.", url: `${BASE}/detail/relic` },
  "/ranking":        { title: "초능력자 랭킹 — 전체 순위 확인", description: "초능력자 카카오톡 챗봇 서버 전체 순위. 초능력자 점수·포인트·유물 자산·배틀 전적 기준 랭킹.", url: `${BASE}/ranking` },
  "/patchnotes":     { title: "초능력자 - 패치노트",    description: "초능력자 카카오톡 챗봇 업데이트 기록. 신규 기능, 밸런스 조정, 버그 수정 내역을 확인하세요.", url: `${BASE}/patchnotes` },
  "/balance":        { title: "초능력자 - 밸런스 현황", description: "초능력자 카카오톡 챗봇 포인트 획득량·유물 강화 성공률 등 밸런스 데이터를 확인하세요.", url: `${BASE}/balance` },
  "/policy":         { title: "초능력자 - 개인정보처리방침", description: "초능력자 카카오톡 챗봇 서비스 개인정보처리방침", url: `${BASE}/policy` },
  "/terms":          { title: "초능력자 - 이용약관",    description: "초능력자 카카오톡 챗봇 서비스 이용약관", url: `${BASE}/terms` },
  "/contact":        { title: "초능력자 - 연락처",      description: "초능력자 카카오톡 챗봇 서비스 운영자 연락처 및 문의 방법", url: `${BASE}/contact` },
};

function buildOgHtml(og) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${esc(og.title)}</title>
<meta name="description" content="${esc(og.description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(og.title)}"/>
<meta property="og:description" content="${esc(og.description)}"/>
<meta property="og:url" content="${esc(og.url)}"/>
<meta property="og:image" content="${IMAGE}"/>
<meta property="og:locale" content="ko_KR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(og.title)}"/>
<meta name="twitter:description" content="${esc(og.description)}"/>
<meta name="twitter:image" content="${IMAGE}"/>
<link rel="canonical" href="${esc(og.url)}"/>
</head>
<body></body>
</html>`;
}

async function fetchNickname(uid) {
  try {
    const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(uid)}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.user?.nickname ?? null;
  } catch {
    return null;
  }
}

async function resolveOg(pathname, searchParams, hostname) {
  if (hostname === "rank.chosung.app") {
    return {
      title:       "초능력자 랭킹 — 전체 순위 확인",
      description: "초능력자 카카오톡 챗봇 서버 전체 순위. 초능력자 점수·포인트·유물 자산·배틀 전적 기준 랭킹.",
      url:         RANK,
    };
  }
  if (pathname === "/profile") {
    const uid      = searchParams.get("uid") ?? "";
    const nickname = uid ? await fetchNickname(uid) : null;
    return {
      title:       nickname ? `초능력자 프로필 - ${nickname}` : "초능력자 프로필",
      description: "초능력자 카카오톡 챗봇 유저 프로필. 포인트·유물·배틀 전적을 한눈에 확인하세요.",
      url:         uid ? `${BASE}/profile?uid=${uid}` : `${BASE}/profile`,
    };
  }
  return STATIC_MAP[pathname] ?? DEFAULT_OG;
}

// ── Static file helpers ───────────────────────────────────────────────────────
function serveFile(filePath, res) {
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] ?? "application/octet-stream";
  const isHtml   = ext === ".html";
  const stat     = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type":   mimeType,
    "Content-Length": stat.size,
    "Cache-Control":  isHtml ? "no-cache" : "public, max-age=31536000, immutable",
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveIndex(res) {
  const indexPath = path.join(DIST, "index.html");
  const stat      = fs.statSync(indexPath);
  res.writeHead(200, {
    "Content-Type":   "text/html; charset=utf-8",
    "Content-Length": stat.size,
    "Cache-Control":  "no-cache",
  });
  fs.createReadStream(indexPath).pipe(res);
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const rawUrl      = req.url ?? "/";
  const qIdx        = rawUrl.indexOf("?");
  const pathname    = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;
  const searchParams = new URLSearchParams(qIdx >= 0 ? rawUrl.slice(qIdx + 1) : "");
  const hostname    = (req.headers["host"] ?? "").split(":")[0];
  const ua          = req.headers["user-agent"] ?? "";

  // 1. Crawler → dynamic OG HTML (only for non-asset paths)
  const looksLikeAsset = /\.[a-zA-Z0-9]+$/.test(pathname);
  if (!looksLikeAsset && CRAWLER_UA.test(ua)) {
    const og   = await resolveOg(pathname, searchParams, hostname);
    const html = buildOgHtml(og);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  // 2. Static asset
  const filePath = path.join(DIST, pathname === "/" ? "index.html" : pathname);
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) { serveFile(filePath, res); return; }
  } catch {
    // file not found → fall through to SPA fallback
  }

  // 3. SPA fallback
  serveIndex(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`og-server listening on port ${PORT}`);
});
