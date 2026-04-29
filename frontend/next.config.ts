import type { NextConfig } from "next";

// These env vars are only set in CI (GITHUB_PAGES) or via `make preview-ghpages`
// (GITHUB_PAGES_PREVIEW). Neither is set during normal dev or Docker builds,
// so output stays "standalone" and basePath stays "" — no effect on the app.
const isGhPages = process.env.GITHUB_PAGES === "true";
const isGhPagesPreview = process.env.GITHUB_PAGES_PREVIEW === "true";

const nextConfig: NextConfig = {
  output: isGhPages || isGhPagesPreview ? "export" : "standalone",
  basePath: isGhPages ? "/s2dm-example-charging-session-app" : "",
  trailingSlash: isGhPages || isGhPagesPreview,
  reactStrictMode: false,
};

export default nextConfig;
