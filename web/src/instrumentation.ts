import type { Instrumentation } from "next";

/**
 * One structured line per server error, readable in the Vercel logs. Request
 * headers are left out on purpose: they carry the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_error",
      message: error instanceof Error ? error.message : String(error),
      digest,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    }),
  );
};
