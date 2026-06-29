import { useEffect } from "react";

const DEFAULT: OgMeta = {
  title: "초능력자 - 카카오톡 챗봇",
  description: "1인 개발 챗봇 프로젝트입니다! 모든 이용자 분께 감사의 인사를 드립니다",
  url: "https://chosung.app/",
  image: "https://chosung.app/chosung-og.png",
};

export interface OgMeta {
  title: string;
  description: string;
  url?: string;
  image?: string;
}

function setMeta(meta: OgMeta) {
  const url   = meta.url   ?? DEFAULT.url;
  const image = meta.image ?? DEFAULT.image;

  document.title = meta.title;
  document.querySelector('meta[name="description"]')         ?.setAttribute("content", meta.description);
  document.querySelector('meta[property="og:title"]')        ?.setAttribute("content", meta.title);
  document.querySelector('meta[property="og:description"]')  ?.setAttribute("content", meta.description);
  document.querySelector('meta[property="og:url"]')          ?.setAttribute("content", url!);
  document.querySelector('meta[property="og:image"]')        ?.setAttribute("content", image!);
  document.querySelector('meta[name="twitter:title"]')       ?.setAttribute("content", meta.title);
  document.querySelector('meta[name="twitter:description"]') ?.setAttribute("content", meta.description);
  document.querySelector('meta[name="twitter:image"]')       ?.setAttribute("content", image!);
  document.querySelector('link[rel="canonical"]')            ?.setAttribute("href", url!);
}

export function useOgMeta(meta: OgMeta) {
  useEffect(() => {
    setMeta(meta);
    return () => setMeta(DEFAULT);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, meta.description, meta.url]);
}
