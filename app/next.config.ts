import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'decidable-bridged-spotting.ngrok-free.dev'
  ],
  // /connect-agents moved under /docs; keep the old URL alive
  async redirects() {
    return [
      {
        source: "/connect-agents",
        destination: "/docs/connect-agents",
        permanent: true,
      },
    ];
  },

  // MCP clients probe OAuth metadata at the ORIGIN root (RFC 8414/9728), with or
  // without the issuer path appended. Our routes live under /api/mcp.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/mcp/.well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/mcp/.well-known/oauth-authorization-server",
      },
    ];
  },
};

export default nextConfig;
