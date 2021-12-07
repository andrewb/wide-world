module.exports = {
  extends: ["airbnb-base", "prettier"],
  ignorePatterns: ["lib"],
  env: {
    browser: true,
    jest: true,
  },
  globals: {
    ENV: true,
  },
  plugins: ["prettier"],
  rules: {
    "import/extensions": ["error", "always"],
    "no-underscore-dangle": "off",
    "no-plusplus": "off",
  },
};
