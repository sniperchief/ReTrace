import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/sign-in", "/sign-up"];
const LANDING = "/";

/**
 * Fast redirect for visitors without a session cookie. This is only a UX
 * shortcut: every page and Server Action still verifies the session against
 * the database via `requireTechnician()`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === LANDING) {
    // Signed-in technicians skip the landing page and go straight into the app.
    return getSessionCookie(request)
      ? NextResponse.redirect(new URL("/home", request.url))
      : NextResponse.next();
  }
  if (PUBLIC_PATHS.some((p) => pathname === p)) return NextResponse.next();
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Pages only. API routes authenticate themselves and answer 401 as JSON.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
