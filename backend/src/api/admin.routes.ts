import express from "express";
import { dbPool } from "../db/pool";
import { requireAuth } from "../middleware/auth";
import { findUserById } from "../db/repositories/users";

export const adminRouter = express.Router();

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const userId = req.userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await findUserById(userId);
    if (user?.is_guest) {
      res.status(403).json({ error: "Guest accounts cannot access admin" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify user" });
  }
}

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

adminRouter.get("/heroes", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM heroes ORDER BY id ASC");
    res.json({ heroes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list heroes" });
  }
});

adminRouter.get("/monsters", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM monsters ORDER BY id ASC");
    res.json({ monsters: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list monsters" });
  }
});

adminRouter.get("/powers", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM powers ORDER BY name ASC");
    res.json({ powers: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list powers" });
  }
});

adminRouter.post("/sessions/:id/end", async (req, res) => {
  try {
    const { id } = req.params;
    await dbPool.query("UPDATE game_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1", [
      id
    ]);
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to end session" });
  }
});

