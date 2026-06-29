# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: 초능력자 KakaoTalk 봇 (chosung.app)

### Domain & Features
- **도메인**: https://chosung.app/
- **봇 이름**: 초능력자
- **테마**: 보라색

### Game Features
- 초성퀴즈: 초성 맞히기 게임, 포인트(P) 지급
- 훈민정음 멀티플레이: 초성+글자수로 단어 맞히기, 종료 후 MVP 보너스
- 콤보 시스템: 10분 내 5회 승리 → 60초 +20% 보너스 (게임 종류 무관), `computeReward()`로 통합
- 랭킹: 서버/방 랭킹
- 포인트(P): score 컬럼 (users 테이블)

### 신규 유물 시스템 (newRelicSystem.ts)
- D/C/B/A/S 5등급, 8종 유물 타입 (나침반/모래시계/랜턴/거울/보물함/왕관/물약/깃털펜)
- 강화(0~+20), 레벨업(1~30), 합성(하위 등급 → 상위), 분해(포인트 환급)
- 보관함: 메인 유물 외 추가 유물 보관, 보관 효과 약 35% 적용 (STORAGE_EFFECT_RATIO=0.3531)
- DB 테이블: `relics`, `relic_types`
- 카카오 명령어: 내유물, 유물보관함, 유물강화, 유물합성, 유물분해, 유물뽑기

### 자모연성 게임 (jamoGame.ts)
- 한글 자모 분해 후 4지선다 퍼즐
- 난이도: 쉬움(2글자·760P), 보통(3글자·1140P), 어려움(4글자·1720P)
- 보너스: 긴단어+290P, 받침+190P, 첫자모연성+480P, 연속3회+950P
- 카카오 명령어: 자모연성, 자모연성 쉬움/보통/어려움, 자모포기

### 이전 유물 시스템 (artifactState.ts) — 웹사이트에서 제거됨
- 1~3성 시스템 (구버전); `computeReward`, `IS_PRODUCTION` 함수는 여전히 kakao.ts에서 사용

### 웹사이트 테마
- **전체 다크 테마**: `#070710` 배경 (ProfilePage와 동일)
- CSS 변수: `--bg:#070710`, `--ink:#e2e8f0`, `--muted:#64748b`, `--border:rgba(255,255,255,0.07)`
- `--orange`/`--blue` → 퍼플 계열(`#a78bfa`/`#818cf8`)로 리매핑
- 마스코트 이미지: `chosung-hero3-nobg.png` (배경 제거)
- `manifest.json` background_color → `#070710`

### 핵심 파일
- `artifacts/api-server/src/lib/artifactState.ts` — 유물 시스템 전체 로직
- `artifacts/api-server/src/lib/gameState.ts` — 게임 상태/리워드 기존 로직
- `artifacts/api-server/src/routes/kakao.ts` — 카카오 봇 라우트 핸들러
- `artifacts/chosung-quiz/src/` — 소개 웹사이트 (React+Vite, 다크 테마)
- `artifacts/chosung-quiz/src/index.css` — 메인 CSS (2360+ 줄, 다크 테마 전환, amber/green 추가)
- `artifacts/chosung-quiz/src/DetailPage.tsx` — 상세 페이지: chosung/hunmin/combo/jamo/relic (5개)
- `artifacts/chosung-quiz/public/manifest.json` — PWA 매니페스트

### DB Tables (artifact system)
- `user_artifacts` — 유물 보유 (user_id, artifact_name, star, level)
- `artifact_stats` — 강화/성급 통계
- `artifact_combo_state` — 콤보 상태 (per user, per day)
- `artifact_battle_data` — 배틀 전적/일일 횟수
- `artifact_battle_targets` — 오늘 특정 상대 배틀 횟수
- `artifact_battle_history` — 배틀 기록
- `artifact_point_log` — 포인트 로그
- `users.total_earned_point` / `users.total_spent_point` — 누적 획득/소비 포인트

### Auth
- BOT_AUTH: 환경변수 (헤더: `auth`)
- ADMIN_TOKEN: 환경변수
