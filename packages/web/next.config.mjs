/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared workspace package ships TS source; let Next transpile it.
  transpilePackages: ["@consilium/shared"],
};

export default nextConfig;
