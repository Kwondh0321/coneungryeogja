import app from "./app";
import { logger } from "./lib/logger";
import { initFromDb, loadQuizBank, initComboState } from "./lib/gameState";
import { initArtifactDb } from "./lib/artifactState";
import { initRelicTables, recalcAllRelicEffects, migrateRelicAssets } from "./lib/newRelicSystem";
import { initMonitoringTable } from "./lib/monitoring";
import { warmRankingCaches } from "./routes/kakao";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function bootstrap() {
  // rankingBoard(유저 닉네임·점수 캐시) 구축이 완료된 후 서버를 시작해야
  // 재배포 직후 요청이 들어와도 기존 닉네임이 초기화되지 않음
  await initFromDb();
  logger.info("DB 캐시 초기화 완료");

  // 나머지 초기화는 병렬 실행 (서버 시작을 블록할 필요 없음)
  initComboState()
    .then(() => { logger.info("콤보 상태 DB 복원 완료"); })
    .catch((err) => { logger.error({ err }, "콤보 상태 복원 실패 (서버는 계속 실행)"); });

  loadQuizBank()
    .then(() => { logger.info("퀴즈 뱅크 DB 로드 완료"); })
    .catch((err) => { logger.error({ err }, "퀴즈 뱅크 로드 실패 (서버는 계속 실행)"); });

  pool.query("DROP TABLE IF EXISTS pets")
    .then(() => { logger.info("pets 테이블 제거 완료 (또는 이미 없음)"); })
    .catch((err) => { logger.error({ err }, "pets 테이블 제거 실패"); });

  initArtifactDb()
    .then(() => { logger.info("유물 시스템 DB 초기화 완료"); })
    .catch((err) => { logger.error({ err }, "유물 시스템 DB 초기화 실패 (서버는 계속 실행)"); });

  initRelicTables()
    .then(() => {
      logger.info("신규 유물 시스템 DB 초기화 완료");
      return recalcAllRelicEffects();
    })
    .then((n) => {
      logger.info({ updated: n }, "유물 effect_value 자동 재계산 완료");
      return migrateRelicAssets();
    })
    .then((n) => { logger.info({ updated: n }, "유물 자산가치 마이그레이션 완료"); })
    .catch((err) => { logger.error({ err }, "신규 유물 시스템 초기화/마이그레이션 실패 (서버는 계속 실행)"); });

  initMonitoringTable()
    .then(() => { logger.info("모니터링 테이블 초기화 완료"); })
    .catch((err) => { logger.error({ err }, "모니터링 테이블 초기화 실패 (서버는 계속 실행)"); });

  warmRankingCaches()
    .then(() => { logger.info("랭킹 캐시 워밍업 완료"); })
    .catch((err) => { logger.error({ err }, "랭킹 캐시 워밍업 실패 (서버는 계속 실행)"); });

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, "서버 초기화 실패 — 종료");
  process.exit(1);
});
