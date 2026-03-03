import express from "express";
import { hashPassword, verifyPassword, signAccessToken } from "../utils/auth";
import { createUser, findUserByEmail, findUserById, findUserByUsername } from "../db/repositories/users";
import { requireAuth } from "../middleware/auth";

export const authRouter = express.Router();

authRouter.post("/register", async (req, res) => {
  const { username, email, password } = req.body ?? {};

  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email and password are required" });
    return;
  }

  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Invalid field types" });
    return;
  }

  if (username.length < 3 || username.length > 50) {
    res.status(400).json({ error: "Username must be between 3 and 50 characters" });
    return;
  }

  try {
    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const existingByUsername = await findUserByUsername(username);
    if (existingByUsername) {
      res.status(409).json({ error: "Username already in use" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser({ username, email, passwordHash });
    const token = signAccessToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch {
    res.status(500).json({ error: "Failed to register user" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = signAccessToken(user.id);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch {
    res.status(500).json({ error: "Failed to login" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

