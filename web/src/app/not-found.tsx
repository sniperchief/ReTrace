import { LinkButton } from "@/components/ui";
import { getMessages } from "@/i18n";

export default function NotFound() {
  const t = getMessages();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{t.notFound.title}</h1>
      <p className="text-muted">{t.notFound.body}</p>
      <LinkButton href="/generators">{t.notFound.home}</LinkButton>
    </main>
  );
}
