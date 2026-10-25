/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["cesium"],
  turbopack: {},
  output: "export",
};

export default nextConfig;
