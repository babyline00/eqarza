import type { NextConfig } from "next";

// Custom admin panel path. When ADMIN_PATH is set to something other than
// "/admin" (e.g. "/eqarza-admin"), the admin page moves there and the old
// "/admin" URL redirects to it. Baked in at build time.
function adminPath(): string {
  const raw = process.env.ADMIN_PATH?.trim();
  if (!raw) return "/admin";
  let p = raw.startsWith("/") ? raw : `/${raw}`;
  p = p.replace(/\/+$/, "");
  return p || "/admin";
}

const ADMIN_PATH = adminPath();
const CUSTOM_ADMIN = ADMIN_PATH !== "/admin";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.10.5:3000"],
  ...(CUSTOM_ADMIN
    ? {
        async redirects() {
          return [{ source: "/admin", destination: ADMIN_PATH, permanent: false }];
        },
        async rewrites() {
          return [{ source: ADMIN_PATH, destination: "/admin" }];
        },
      }
    : {}),
};

export default nextConfig;
