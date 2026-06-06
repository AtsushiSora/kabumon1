const isGithubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath = "/kabumon1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isGithubPages ? githubPagesBasePath : "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: isGithubPages,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};

export default nextConfig;
