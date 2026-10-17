import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/schemas/auth";
import { getDb, getMongoClient } from "./db";
import { getEnv } from "./env";

function createAuth() {
  const env = getEnv();
  return betterAuth({
    appName: "ReTrace",
    secret: env.AUTH_SECRET,
    baseURL: env.AUTH_URL,
    database: mongodbAdapter(getDb(), { client: getMongoClient() }),
    // Technician accounts live in `technicians`; sessions etc. use the defaults.
    user: { modelName: "technicians" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      autoSignIn: true,
      // No email provider in the $0 setup, so addresses aren't verified yet.
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days: technicians stay signed in on their phone
      updateAge: 60 * 60 * 24,
    },
    rateLimit: { enabled: process.env.NODE_ENV === "production" },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** Created on first use so builds don't need database credentials. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
