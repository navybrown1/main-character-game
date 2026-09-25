/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Local webp assets only; no remote images.
    unoptimized: false,
  },
};

export default nextConfig;
