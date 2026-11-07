module.exports = {
  preset: "jest-expo",
  resolver: "react-native-reanimated/jest/resolver",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  collectCoverageFrom: ["src/core/**/*.ts", "src/app/runtime.ts"],
};
