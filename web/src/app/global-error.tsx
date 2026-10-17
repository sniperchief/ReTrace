"use client";

/**
 * Last resort when the root layout itself fails: no app styles or messages
 * are available here, so it's plain and self-contained.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#fafafa",
        color: "#151035", fontFamily: "system-ui, sans-serif", padding: 16, textAlign: "center" }}>
        <main>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#5b5875", margin: "0 0 20px" }}>ReTrace couldn&apos;t load. Your saved records are safe.</p>
          <button type="button" onClick={() => retry()} style={{ background: "#1ccac7", color: "#151035", border: 0,
            borderRadius: 8, padding: "12px 20px", fontSize: 16, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
