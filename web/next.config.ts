import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Every signed-in page verifies the session against the database on each
    // request, so its navigations wait for that by design. Only check "instant
    // navigation" on segments that opt in with `export const instant`, instead of
    // flagging every page in development. Production behaviour is unchanged.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
