import http from "http";
import express from "express";
import cors from "cors";
import { Server as ColyseusServer } from "colyseus";
import { config } from "./config/env";
import { authRouter } from "./api/auth.routes";
import { NoHeroesRoom } from "./rooms/NoHeroesRoom";
import { replayRouter } from "./api/replay.routes";
import { referenceRouter } from "./api/reference.routes";
import { lobbyRouter } from "./api/lobby.routes";
import { adminRouter } from "./api/admin.routes";

async function bootstrap() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/auth", authRouter);
  app.use("/", lobbyRouter);
  app.use("/", referenceRouter);
  app.use("/", replayRouter);
  app.use("/", adminRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const httpServer = http.createServer(app);
  const gameServer = new ColyseusServer({} as any);

  gameServer.define("no_heroes_room", NoHeroesRoom).filterBy(["sessionId"]);

  const port = config.port;
  httpServer.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal error during bootstrap", err);
  process.exit(1);
});

