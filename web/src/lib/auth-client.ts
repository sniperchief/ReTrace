import { createAuthClient } from "better-auth/react";

/** Browser-side auth client. Talks only to this app's /api/auth routes. */
export const authClient = createAuthClient();
