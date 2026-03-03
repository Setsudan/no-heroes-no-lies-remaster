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

