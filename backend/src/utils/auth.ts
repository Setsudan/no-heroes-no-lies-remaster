import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../config/env";

const BCRYPT_ROUNDS = 10;

export interface JwtPayload {
  sub: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(userId: string): string {
  const payload: JwtPayload = { sub: userId };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === "string" || !decoded.sub) {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}

