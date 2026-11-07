const expo = require("eslint-config-expo/flat");
module.exports = [
  {
    ignores: [
      ".agents/**",
      ".superpowers/**",
      ".worktrees/**",
      "ios/**",
      "android/**",
      "coverage/**",
      "dist/**",
    ],
  },
  ...expo,
];
