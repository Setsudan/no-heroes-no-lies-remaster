import { dbPool } from "../db/pool";
import { GameEngineEvent } from "./GameEngine";

export async function appendGameEvent(sessionId: string, event: GameEngineEvent): Promise<void> {
  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");

    const seqResult = await client.query<{ next_seq: number }>(
      "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM game_session_logs WHERE session_id = $1",
      [sessionId]
    );
    const nextSeq = seqResult.rows[0]?.next_seq ?? 1;

    await client.query(
      "INSERT INTO game_session_logs (session_id, seq, event_type, payload) VALUES ($1, $2, $3, $4)",
      [sessionId, nextSeq, event.type, event]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

