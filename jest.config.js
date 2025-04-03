export default {
  transform: {},
  testEnvironment: 'node',
  // Since we use "type": "module" in package.json, Jest automatically treats .js files as ESM
  // No need for extensionsToTreatAsEsm
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Set a timeout for tests to avoid hanging
  testTimeout: 10000,
  // Force exit after tests complete to avoid hanging processes
  forceExit: true
};