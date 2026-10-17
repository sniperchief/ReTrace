"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/i18n";
import { useMessages } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import { toFieldErrors, type FieldErrors } from "@/lib/schemas/common";
import { PASSWORD_MAX, signInSchema, signUpSchema } from "@/lib/schemas/auth";
import { Field, FormError, TextInput } from "./form";
import { buttonStyles } from "./ui";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const t = useMessages();
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse(raw);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setPending(true);
    // The server validates again; this only gives faster feedback.
    const { error } = isSignUp
      ? await authClient.signUp.email(parsed.data as { name: string; email: string; password: string })
      : await authClient.signIn.email(parsed.data);
    if (error) {
      setPending(false);
      if (isSignUp && error.status === 422) setFormError(t.auth.emailTaken);
      else if (!isSignUp && error.status === 401) setFormError(t.auth.invalidCredentials);
      else setFormError(t.auth.genericError);
      return;
    }
    // New accounts start the guided setup; returning technicians go home.
    router.replace(isSignUp ? "/welcome" : "/home");
    router.refresh();
  }

  const err = (field: string) => (errors[field] ? errorMessage(t, errors[field]?.[0]) : undefined);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormError message={formError} />
      {isSignUp && (
        <Field id="name" label={t.auth.name} error={err("name")}>
          <TextInput id="name" name="name" autoComplete="name" maxLength={100} required invalid={!!err("name")} />
        </Field>
      )}
      <Field id="email" label={t.auth.email} error={err("email")}>
        <TextInput id="email" name="email" type="email" autoComplete="email" inputMode="email"
          maxLength={254} required invalid={!!err("email")} />
      </Field>
      <Field id="password" label={t.auth.password} hint={isSignUp ? t.auth.passwordHint : undefined}
        error={err("password")}>
        <TextInput id="password" name="password" type="password" maxLength={PASSWORD_MAX} required
          autoComplete={isSignUp ? "new-password" : "current-password"} invalid={!!err("password")} />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
        {pending ? t.common.saving : isSignUp ? t.auth.signUpButton : t.auth.signInButton}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignUp ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="font-medium text-foreground underline underline-offset-2">
          {isSignUp ? t.auth.goToSignIn : t.auth.goToSignUp}
        </Link>
      </p>
    </form>
  );
}
