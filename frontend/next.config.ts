import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// `next dev` runs with cwd `frontend/`. The repo-root `.env` is the source of
// truth; Docker instead passes CARTO_API_KEY as a build arg (see Dockerfile).
if (!process.env.CARTO_API_KEY) {
  const rootEnvPath = path.resolve(process.cwd(), "..", ".env");
  if (fs.existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
}

// These env vars are only set in CI (GITHUB_PAGES) or via `make preview-ghpages`
// (GITHUB_PAGES_PREVIEW). Neither is set during normal dev or Docker builds,
// so output stays "standalone" and basePath stays "" — no effect on the app.
const isGhPages = process.env.GITHUB_PAGES === "true";
const isGhPagesPreview = process.env.GITHUB_PAGES_PREVIEW === "true";

const nextConfig: NextConfig = {
  // Public basemap key. Inlined into the client bundle (it is sent on tile URLs).
  env: {
    CARTO_API_KEY: process.env.CARTO_API_KEY ?? ""
  },
  output: isGhPages || isGhPagesPreview ? "export" : "standalone",
  basePath: isGhPages ? "/s2dm-example-charging-session-app" : "",
  trailingSlash: isGhPages || isGhPagesPreview,
  reactStrictMode: false,
  // Skip type-checking files unrelated to the data-model page (e.g. pages
  // that import codegen output not available in the GH Pages build).
  typescript: { ignoreBuildErrors: isGhPages || isGhPagesPreview },
};

export default nextConfig;
