import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The parser ships ESM with extensionless imports; bundle it instead of
  // letting the production Node.js runtime load the package directly.
  transpilePackages: ["dt-sql-parser"],
};

export default nextConfig;
