import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  jwtSecret: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  db: {
    host: requireEnv("POSTGRES_HOST", "postgres"),
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: requireEnv("POSTGRES_USER", "game"),
    password: requireEnv("POSTGRES_PASSWORD", "game"),
    database: requireEnv("POSTGRES_DB", "no_heroes_no_lies")
  },
  jwtSecret: requireEnv("JWT_SECRET", "dev-secret")
};

