import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone-Output fuer Docker Deployment (minimales Image)
  output: "standalone",

  // Word-Vorlagen werden zur Laufzeit via fs.readFileSync gelesen — Next.js'
  // statisches Output-Tracing erkennt das nicht. Ohne diesen Eintrag fehlen
  // die .docx-Vorlagen im Standalone-Image und die Export-Routen werfen
  // ENOENT (sichtbar als 503 in /api/export/nachtrag und /api/export/stellenanteil).
  outputFileTracingIncludes: {
    "/api/export/**": ["./src/lib/export/vorlagen/**"],
  },

  // Security-Headers fuer On-Premise Deployment
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
          },
        ],
      },
      // API-Endpunkte: kein Caching
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
