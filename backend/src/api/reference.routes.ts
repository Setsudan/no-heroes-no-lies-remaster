import express from "express";
import fs from "fs";
import path from "path";
import { dbPool } from "../db/pool";

export const referenceRouter = express.Router();

referenceRouter.get("/heroes", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM heroes ORDER BY id ASC");
    res.json({ heroes: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to load heroes" });
  }
});

referenceRouter.get("/monsters", async (_req, res) => {
  try {
    const result = await dbPool.query("SELECT * FROM monsters ORDER BY id ASC");
    res.json({ monsters: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to load monsters" });
  }
});

referenceRouter.get("/rules", async (_req, res) => {
  try {
    const filePath = path.resolve(__dirname, "..", "..", "rules.md");
    const content = await fs.promises.readFile(filePath, "utf8");
    res.type("text/markdown").send(content);
  } catch {
    res.status(500).json({ error: "Failed to load rules" });
  }
});

