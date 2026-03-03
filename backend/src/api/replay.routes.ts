import express from "express";
import { dbPool } from "../db/pool";

export const replayRouter = express.Router();

replayRouter.get("/sessions/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const sessionResult = await dbPool.query(
      "SELECT * FROM game_sessions WHERE id = $1",
      [id]
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const participantsResult = await dbPool.query(
      "SELECT * FROM game_session_participants WHERE session_id = $1 ORDER BY turn_order ASC",
      [id]
    );

    res.json({
      session: sessionResult.rows[0],
      participants: participantsResult.rows
    });
  } catch {
    res.status(500).json({ error: "Failed to load session" });
  }
});

replayRouter.get("/sessions/:id/logs", async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit ?? 200), 1000);
  const offset = Number(req.query.offset ?? 0);

  try {
    const logsResult = await dbPool.query(
      "SELECT * FROM game_session_logs WHERE session_id = $1 ORDER BY seq ASC LIMIT $2 OFFSET $3",
      [id, limit, offset]
    );

    res.json({
      logs: logsResult.rows,
      limit,
      offset
    });
  } catch {
    res.status(500).json({ error: "Failed to load session logs" });
  }
});

