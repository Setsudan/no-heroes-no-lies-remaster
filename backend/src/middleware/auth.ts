import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/auth";
import { findUserById } from "../db/repositories/users";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();

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

