/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "scontent.fbog2-1.fna.fbcdn.net",
      "scontent.cdninstagram.com",
      "storage.googleapis.com",
      "lh3.googleusercontent.com",
    ],
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
