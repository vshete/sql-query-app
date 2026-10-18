import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parser ships ESM with extensionless imports; bundle it instead of
  // letting the production Node.js runtime load the package directly.
  // readFile paths must also be shipped with traced production functions.
  outputFileTracingIncludes: {
    "/*": [
      "./src/lib/server/agent/prompts/*.md",
      "./src/lib/server/database/sql/*.sql",
    ],
  },
  transpilePackages: ["dt-sql-parser"],
};

export default nextConfig;
