/**
 * 
 */
// https://jestjs.io/docs/en/configuration.html
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.(spec|test).[jt]s'],
  reporters: [
    'default',
    'jest-html-reporters'
  ],
  collectCoverage: true,
  coverageReporters: [
    'html',
    'lcov',
    'json',
    'text',
    'clover',
    'text-summary',
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
      diagnostics: false,
    },
  }
};
