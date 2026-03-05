export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Stub out external modules that aren't available in test env
    "^openclaw/plugin-sdk$": "<rootDir>/tests/__mocks__/openclaw-plugin-sdk.ts",
    "^@acontext/acontext$": "<rootDir>/tests/__mocks__/acontext-sdk.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          esModuleInterop: true,
          allowImportingTsExtensions: true,
          noEmit: true,
          strict: false,
          skipLibCheck: true,
          typeRoots: ["./node_modules/@types", "."],
        },
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts"],
};
