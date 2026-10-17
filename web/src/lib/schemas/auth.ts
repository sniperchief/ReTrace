import { z } from "zod";
import { requiredText } from "./common";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const email = z.string().trim().toLowerCase().pipe(z.email("invalidEmail"));
const password = z
  .string({ error: "required" })
  .min(PASSWORD_MIN, "passwordTooShort")
  .max(PASSWORD_MAX, "passwordTooLong");

export const signUpSchema = z.object({ name: requiredText(100), email, password });
export const signInSchema = z.object({ email, password: z.string().min(1, "required") });
