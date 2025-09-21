
import type {NextConfig} from 'next';
import { withPWA } from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  serverActions: {
    bodySizeLimit: '5mb',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  async rewrites() {
    return [
      {
        source: '/politica-de-privacidade.html',
        destination: '/politica-de-privacidade',
      },
    ]
  },
};

export default withPWA({
    dest: "public",
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === "development",
    sw: "firebase-messaging-sw.js",
})(nextConfig);
