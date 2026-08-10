import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Stub out @x402/* packages that @coinbase/cdp-sdk imports transitively
    // through: rainbowkit → @wagmi/connectors/baseAccount →
    // @base-org/account → @coinbase/cdp-sdk → @x402/*.
    // These are server-only packages with no browser build.
    resolveAlias: {
      "@x402/core/client": "./lib/empty-stub.js",
      "@x402/evm": "./lib/empty-stub.js",
      "@x402/evm/exact/client": "./lib/empty-stub.js",
      "@x402/evm/upto/client": "./lib/empty-stub.js",
      "@x402/svm/exact/client": "./lib/empty-stub.js",
    },
  },
};

export default nextConfig;
