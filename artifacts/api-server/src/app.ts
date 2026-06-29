import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BOT_AUTH = process.env["BOT_AUTH"];

const POST_AUTH_WHITELIST = ["/api/stats/visit"];

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") {
    if (POST_AUTH_WHITELIST.includes(req.path)) return next();
    if (!BOT_AUTH) {
      logger.warn("BOT_AUTH 환경변수가 설정되지 않아 인증을 건너뜁니다");
      return next();
    }
    const headerAuth = req.headers["auth"] as string | undefined;
    if (headerAuth !== BOT_AUTH) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  next();
});

app.use("/api", router);

export default app;
