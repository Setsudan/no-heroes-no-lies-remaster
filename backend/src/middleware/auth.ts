import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/auth";
import { findUserById } from "../db/repositories/users";
import { AUTH_COOKIE_NAME } from "../utils/cookies";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  let token: string | null = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  } else {
    const cookieToken = (req as any).cookies?.[AUTH_COOKIE_NAME];
    if (typeof cookieToken === "string" && cookieToken.length > 0) {
      token = cookieToken;
    }
  }

  if (!token) {
    res.status(401).json({ error: "Missing or invalid auth token" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "User not found for token" });
      return;
    }
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

