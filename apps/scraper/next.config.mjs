/** @type {import('next').NextConfig} */
let nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  distDir: process.env.NODE_ENV === "development" ? ".next/dev" : ".next/build",

  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
    externalDir: true,
  },
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.js\.map$/,
      use: "null-loader",
    });
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/undici/,
      use: {
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env"],
        },
      },
    });

    if (process.env.ENABLE_SOURCE_MAPS === "true") {
      config.devtool =
        process.env.NODE_ENV === "development"
          ? "eval-source-map"
          : "source-map";
    }

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    return config;
  },
};

if (process.env.ANALYZE === "true") {
  const withBundleAnalyzer = await import("@next/bundle-analyzer").then(
    (mod) => mod.default
  );

  nextConfig = withBundleAnalyzer({
    enabled: true,
  })(nextConfig);
}

export default nextConfig;
