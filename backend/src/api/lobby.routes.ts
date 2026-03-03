import express from "express";
import { dbPool } from "../db/pool";
import { requireAuth } from "../middleware/auth";

export const lobbyRouter = express.Router();

function randomLobbyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(Math.random() * chars.length);
    code += chars.charAt(index);
  }
  return code;
}

lobbyRouter.post("/lobbies", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const { maxPlayers, botCount, burnedHeroesCount } = req.body ?? {};

  const max = Number(maxPlayers ?? 4);
  const bots = Number(botCount ?? 0);
  const burned = Number(burnedHeroesCount ?? 1);

  if (!Number.isInteger(max) || max < 2 || max > 10) {
    res.status(400).json({ error: "maxPlayers must be between 2 and 10" });
    return;
  }

  if (!Number.isInteger(bots) || bots < 0 || bots >= max) {
    res.status(400).json({ error: "botCount must be non negative and less than maxPlayers" });
    return;
  }

  if (!Number.isInteger(burned) || burned < 1) {
    res.status(400).json({ error: "burnedHeroesCount must be at least 1" });
    return;
  }

  const finalCoinsTarget = max + 1;
  const lobbyCode = randomLobbyCode();

  try {
    const result = await dbPool.query(
      "INSERT INTO game_sessions (status, created_by_user_id, player_count, bot_count, rng_seed, final_coins_target, lobby_code, burned_heroes_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      ["waiting", userId, max, bots, null, finalCoinsTarget, lobbyCode, burned]
    );

    const session = result.rows[0];

    res.status(201).json({
      lobby: session,
      room: {
        name: "no_heroes_room",
        sessionId: session.id
      }
    });
  } catch {
    res.status(500).json({ error: "Failed to create lobby" });
  }
});

lobbyRouter.post("/lobbies/:id/join", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const { id } = req.params;
  const { displayName } = req.body ?? {};

  try {
    const sessionResult = await dbPool.query(
      "SELECT * FROM game_sessions WHERE id = $1",
      [id]
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Lobby not found" });
      return;
    }

    const session = sessionResult.rows[0];
    if (session.status !== "waiting") {
      res.status(400).json({ error: "Lobby is not open for joining" });
      return;
    }

    const participantsResult = await dbPool.query(
      "SELECT COUNT(*) AS count FROM game_session_participants WHERE session_id = $1 AND is_bot = false",
      [id]
    );
    const currentPlayers = Number(participantsResult.rows[0].count);
    const maxPlayers = Number(session.player_count);

    if (currentPlayers >= maxPlayers) {
      res.status(400).json({ error: "Lobby is full" });
      return;
    }

    const name =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim()
        : "Player";

    const turnOrder = currentPlayers;

    await dbPool.query(
      "INSERT INTO game_session_participants (session_id, user_id, is_bot, display_name, turn_order) VALUES ($1, $2, false, $3, $4)",
      [id, userId, name, turnOrder]
    );

    res.status(200).json({
      lobby: session,
      room: {
        name: "no_heroes_room",
        sessionId: session.id
      }
    });
  } catch {
    res.status(500).json({ error: "Failed to join lobby" });
  }
});

lobbyRouter.get("/lobbies", requireAuth, async (_req, res) => {
  try {
    const result = await dbPool.query(
      "SELECT * FROM game_sessions WHERE status = 'waiting' ORDER BY created_at DESC"
    );
    res.json({ lobbies: result.rows });
  } catch {
    res.status(500).json({ error: "Failed to list lobbies" });
  }
});

