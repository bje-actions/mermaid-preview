import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      reportsDirectory: 'coverage',
      include: ['src/**'],
      // main.ts and github.ts are the I/O adapter: the entry point that reads
      // inputs, and the Octokit calls. Everything they call is measured here
      // against a fake client; the adapter itself is exercised by the smoke
      // job in ci.yml against a real pull request (the same-repository path;
      // the single-line comment and non-file branches have no venue). Named
      // exclusions with a reason, never a lowered threshold (the enterprise
      // Code Coverage ruleset holds the repository to 95).
      exclude: ['src/main.ts', 'src/github.ts'],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
