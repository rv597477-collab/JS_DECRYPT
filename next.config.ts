import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        child_process: false,
        net: false,
        tls: false,
        module: false,
        perf_hooks: false,
        inspector: false,
        worker_threads: false,
      };
    }
    return config;
  },
};

export default nextConfig;
