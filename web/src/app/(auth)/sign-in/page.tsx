import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getMessages } from "@/i18n";
import { getCurrentTechnician } from "@/server/session";

export const metadata: Metadata = { title: getMessages().auth.signInTitle };

export default async function SignInPage() {
  if (await getCurrentTechnician()) redirect("/home");
  const t = getMessages();
  return (
    <>
      <h1 className="mb-6 text-3xl leading-tight font-bold">{t.auth.signInTitle}</h1>
      <AuthForm mode="sign-in" />
    </>
  );
}
