import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.module.rules.push({
        test: /\.worker\.ts$/,
        loader: "worker-loader",
        options: {
          filename: "static/chunks/[name].[contenthash].js",
          publicPath: "/_next/",
        },
      });
    }
    return config;
  },
};

export default nextConfig;