module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["**/__test__/**/*.ts", "**/__tests__/**/*.ts", "**/*.test.ts"],
    // src/index.test.ts is a build:test entry point / test-helper export, not a test
    // suite (TASK-MUEKRYYWAFMM7 lead decision).
    testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/index.test.ts"],
    collectCoverage: false,
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/test/**/*",
        "!src/**/__test__/**/*",
        "!src/**/__tests__/**/*"
    ],
    testTimeout: 10000,
    forceExit: true,
    verbose: true,
    silent: false
};
