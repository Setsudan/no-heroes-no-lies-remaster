import type { CookieOptions } from "express";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const AUTH_COOKIE_NAME = "auth_token";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax",
  path: "/",
  maxAge: 7 * ONE_DAY_MS
};

export const authCookieClearOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction(),
  sameSite: "lax",
  path: "/"
};

