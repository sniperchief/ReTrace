import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getT } from "@/server/i18n";
import { getCurrentTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).auth.signInTitle };
}

export default async function SignInPage() {
  if (await getCurrentTechnician()) redirect("/home");
  const t = await getT();
  return (
    <>
      <h1 className="mb-6 text-3xl leading-tight font-bold">{t.auth.signInTitle}</h1>
      <AuthForm mode="sign-in" />
    </>
  );
}
