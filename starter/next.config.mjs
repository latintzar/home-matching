/** The first-result UI imports the actual scorer and result scene one directory up. */
export default {
  experimental: {externalDir: true},
  webpack(config) { config.cache = false; return config; },
};
