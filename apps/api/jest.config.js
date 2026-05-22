module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  moduleNameMapper: {
    "^@shared/(.*)$": "<rootDir>/../../../shared/$1"
  },
  testRegex: ".*\\.spec\\.ts$"
};
