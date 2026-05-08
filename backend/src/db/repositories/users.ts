import { dbPool } from "../pool";
import { User } from "../schema";

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await dbPool.query<User>("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await dbPool.query<User>("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await dbPool.query<User>("SELECT * FROM users WHERE username = $1", [username]);
  return result.rows[0] ?? null;
}

export async function createUser(params: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  const result = await dbPool.query<User>(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
    [params.username, params.email, params.passwordHash]
  );
  return result.rows[0];
}

export async function createGuestUser(params: { username: string }): Promise<User> {
  const result = await dbPool.query<User>(
    "INSERT INTO users (username, email, password_hash, is_guest) VALUES ($1, NULL, NULL, true) RETURNING *",
    [params.username]
  );
  return result.rows[0];
}

export async function deleteUser(id: string): Promise<void> {
  await dbPool.query("UPDATE game_session_participants SET user_id = NULL WHERE user_id = $1", [id]);
  await dbPool.query("UPDATE game_sessions SET created_by_user_id = NULL WHERE created_by_user_id = $1", [
    id
  ]);
  await dbPool.query("UPDATE game_sessions SET winner_user_id = NULL WHERE winner_user_id = $1", [id]);
  await dbPool.query("DELETE FROM users WHERE id = $1", [id]);
}

