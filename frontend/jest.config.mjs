// Jest runs the shared vanilla-JS modules as native ES modules in jsdom (no transform, no
// Babel): `node --experimental-vm-modules node_modules/jest/bin/jest.js` (npm run test:unit).
export default {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
  transform: {},
  clearMocks: true,
  collectCoverageFrom: ['shared/**/*.js', '!shared/theme-init.js'],
  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {global: {lines: 80}},
};
