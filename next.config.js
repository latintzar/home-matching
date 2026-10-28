/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {cpus:2},
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  env: {NEXT_PUBLIC_BASE_PATH:process.env.NEXT_PUBLIC_BASE_PATH||'',NEXT_PUBLIC_SAMPLE_MODE:process.env.SAMPLE_MODE==='1'?'1':'0'},

  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized:process.env.SAMPLE_MODE==='1',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'myugajfmoijskiwvwgfa.supabase.co',
      },
    ],
  },
  serverExternalPackages: [
    
    'better-sqlite3', 
    '@mapbox/node-pre-gyp',
    'aws-sdk',
    'nock',
    'mock-aws-s3',
    'node-gyp',
    'npm'
  ],
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'better-sqlite3': 'commonjs better-sqlite3',
      '@mapbox/node-pre-gyp': 'commonjs @mapbox/node-pre-gyp',
      'aws-sdk': 'commonjs aws-sdk',
      'nock': 'commonjs nock',
      'mock-aws-s3': 'commonjs mock-aws-s3',
    });
    return config;
  },
};

module.exports = nextConfig;
// Orchids restart: 1760270501249
