import type { Plugin } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const CRAWLER_UA =
  /kakaotalk-scrap|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|googlebot|bingbot/i;

const BASE  = "https://chosung.app";
const RANK  = "https://rank.chosung.app";
const IMAGE = `${BASE}/chosung-og.png`;

interface OgInfo { title: string; description: string; url: string }

const DEFAULT: OgInfo = {
  title:       "초능력자 - 카카오톡 챗봇",
  description: "1인 개발 챗봇 프로젝트입니다! 모든 이용자 분께 감사의 인사를 드립니다",
  url:         `${BASE}/`,
};

const STATIC_MAP: Record<string, OgInfo> = {
  "/":                  DEFAULT,
  "/detail/chosung":    { title: "초능력자 - 초성퀴즈",    description: "가장 빠르게 초성을 맞춘 사람이 승리! 카카오톡 채팅방에서 친구들과 즐기는 초성 퀴즈 게임. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/chosung` },
  "/detail/hunmin":     { title: "초능력자 - 훈민정음",    description: "아는 단어를 전부 입력하세요! 많이 맞출수록 승리에 가까워지는 단어 배틀. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/hunmin` },
  "/detail/combo":      { title: "초능력자 - 콤보 시스템", description: "세 게임 중 어떤 게임이든 10분 내 5번 이기면 콤보 발동! 60초간 +20% 포인트 보너스. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/combo` },
  "/detail/jamo":       { title: "초능력자 - 자모연성",    description: "흩어진 한글 자모로 단어를 맞히는 퍼즐 게임! 쉬움·보통·어려움 난이도와 연속 정답 보너스. 1인 개발 챗봇 프로젝트입니다!", url: `${BASE}/detail/jamo` },
  "/detail/relic":      { title: "초능력자 - 유물 시스템", description: "게임 드롭으로 수집하고, D→C→B→A→S 5등급으로 강화·합성! 카카오톡 챗봇 유물 시스템 소개.", url: `${BASE}/detail/relic` },
  "/ranking":           { title: "초능력자 랭킹 — 전체 순위 확인", description: "초능력자 카카오톡 챗봇 서버 전체 순위. 초능력자 점수·포인트·유물 자산·배틀 전적 기준 랭킹.", url: `${BASE}/ranking` },
  "/patchnotes":        { title: "초능력자 - 패치노트",    description: "초능력자 카카오톡 챗봇 업데이트 기록. 신규 기능, 밸런스 조정, 버그 수정 내역을 확인하세요.", url: `${BASE}/patchnotes` },
  "/balance":           { title: "초능력자 - 밸런스 현황", description: "초능력자 카카오톡 챗봇 포인트 획득량·유물 강화 성공률 등 밸런스 데이터를 확인하세요.", url: `${BASE}/balance` },
  "/policy":            { title: "초능력자 - 개인정보처리방침", description: "초능력자 카카오톡 챗봇 서비스 개인정보처리방침", url: `${BASE}/policy` },
  "/terms":             { title: "초능력자 - 이용약관",    description: "초능력자 카카오톡 챗봇 서비스 이용약관", url: `${BASE}/terms` },
  "/contact":           { title: "초능력자 - 연락처",      description: "초능력자 카카오톡 챗봇 서비스 운영자 연락처 및 문의 방법", url: `${BASE}/contact` },
};

function buildHtml(og: OgInfo): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<title>${og.title}</title>
<meta name="description" content="${og.description}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${og.title}"/>
<meta property="og:description" content="${og.description}"/>
<meta property="og:url" content="${og.url}"/>
<meta property="og:image" content="${IMAGE}"/>
<meta property="og:locale" content="ko_KR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${og.title}"/>
<meta name="twitter:description" content="${og.description}"/>
<meta name="twitter:image" content="${IMAGE}"/>
<link rel="canonical" href="${og.url}"/>
</head>
<body></body>
</html>`;
}

async function fetchNickname(uid: string, apiBase: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/api/profile/${encodeURIComponent(uid)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { user?: { nickname?: string } };
    return json?.user?.nickname ?? null;
  } catch {
    return null;
  }
}

async function resolveOg(
  urlPath: string,
  query: URLSearchParams,
  hostname: string,
  apiBase: string,
): Promise<OgInfo> {
  if (hostname === "rank.chosung.app") {
    return {
      title:       "초능력자 랭킹 — 전체 순위 확인",
      description: "초능력자 카카오톡 챗봇 서버 전체 순위. 초능력자 점수·포인트·유물 자산·배틀 전적 기준 랭킹.",
      url:         RANK,
    };
  }

  if (urlPath === "/profile") {
    const uid = query.get("uid") ?? "";
    const nickname = uid ? await fetchNickname(uid, apiBase) : null;
    const title = nickname ? `초능력자 프로필 - ${nickname}` : "초능력자 프로필";
    return {
      title,
      description: "초능력자 카카오톡 챗봇 유저 프로필. 포인트·유물·배틀 전적을 한눈에 확인하세요.",
      url: uid ? `${BASE}/profile?uid=${uid}` : `${BASE}/profile`,
    };
  }

  return STATIC_MAP[urlPath] ?? DEFAULT;
}

function makeMiddleware(apiBase: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const ua = req.headers["user-agent"] ?? "";
    if (!CRAWLER_UA.test(ua)) { next(); return; }

    const raw = req.url ?? "/";
    const qIdx = raw.indexOf("?");
    const urlPath = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
    const query   = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : "");
    const hostname = (req.headers.host ?? "").split(":")[0];

    const og   = await resolveOg(urlPath, query, hostname, apiBase);
    const html = buildHtml(og);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  };
}

export function ogCrawlerPlugin(): Plugin {
  const API_BASE = "http://localhost:8080";
  const mw = makeMiddleware(API_BASE);

  return {
    name: "og-crawler",
    configureServer(server) {
      server.middlewares.use(mw);
    },
    configurePreviewServer(server) {
      server.middlewares.use(mw);
    },
  };
}
