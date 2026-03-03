import express from "express";
import { dbPool } from "../db/pool";
import { requireAuth } from "../middleware/auth";

export const adminRouter = express.Router();

async function requireAdmin(req: any): Promise<void> {
  const userId = req.userId as string | undefined;
  if (!userId) {
    const error: any = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}

adminRouter.use(requireAuth);

adminRouter.get("/admin/heroes", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM heroes ORDER BY id ASC");
    res.json({ heroes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list heroes" });
  }
});

adminRouter.get("/admin/monsters", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM monsters ORDER BY id ASC");
    res.json({ monsters: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list monsters" });
  }
});

adminRouter.get("/admin/powers", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM powers ORDER BY name ASC");
    res.json({ powers: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list powers" });
  }
});

adminRouter.post("/admin/sessions/:id/end", async (req, res) => {
  try {
    await requireAdmin(req);
    const { id } = req.params;
    await dbPool.query("UPDATE game_sessions SET status = 'ended', ended_at = NOW() WHERE id = $1", [
      id
    ]);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    if (err.status === 401) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.status(500).json({ error: "Failed to end session" });
  }
});

