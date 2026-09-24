import type { NextConfig } from "next";
const config: NextConfig = {
  ...(process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    ? {
        output: "export",
        trailingSlash: true,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
      }
    : {}),
  devIndicators: false,
  images: { unoptimized: true },
  ...(process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${process.env.API_ORIGIN || "http://127.0.0.1:4000"}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};
export default config;
