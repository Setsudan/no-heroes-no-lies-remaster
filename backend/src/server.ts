import { defineServer, defineRoom } from "colyseus";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { config } from "./config/env";
import { authRouter } from "./api/auth.routes";
import { NoHeroesRoom } from "./rooms/NoHeroesRoom";
import { replayRouter } from "./api/replay.routes";
import { referenceRouter } from "./api/reference.routes";
import { lobbyRouter } from "./api/lobby.routes";
import { adminRouter } from "./api/admin.routes";

async function bootstrap() {
  const server = defineServer({
    rooms: {
      no_heroes_room: defineRoom(NoHeroesRoom)
    },
    express: (app) => {
      app.use(
        cors({
          origin: config.clientOrigin,
          credentials: true
        })
      );
      app.use(cookieParser());
      app.use(express.json());

      app.use("/auth", authRouter);
      app.use("/", lobbyRouter);
      app.use("/", referenceRouter);
      app.use("/", replayRouter);
      app.use("/admin", adminRouter);

      app.get("/health", (_req, res) => {
        res.json({ status: "ok" });
      });
    }
  });
  
  const port = config.port;
  await server.listen(port);
  
  console.log(`Server listening on port ${port}`);
}

bootstrap().catch((err) => {
  console.error("Fatal error during bootstrap", err);
  process.exit(1);
});
