module.exports = {
  extends: ["airbnb-base", "prettier"],
  env: {
    browser: true,
    jest: true,
  },
  globals: {
    ENV: true,
    // TEMP
    m3: true,
  },
  plugins: ["prettier"],
  rules: {
    "import/extensions": ["error", "always"],
    "no-underscore-dangle": "off",
    "no-plusplus": "off",
  },
};
