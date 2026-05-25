import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run tests in Node environment (not jsdom — we're testing server-side code)
    environment: 'node',
    // Test files location
    include: ['tests/**/*.test.js'],
    // Clear mocks between tests
    clearMocks: true,
    // Show verbose output
    reporter: 'verbose',
    // Coverage via v8 (fastest, no instrumentation overhead)
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.js'],
      exclude: ['lib/email.js', 'lib/translate.js', 'lib/rssSearch.js'], // external API callers
      reporter: ['text', 'html'],
      thresholds: {
        // Gradually raise these as coverage improves
        lines: 50,
        functions: 60,
        branches: 45,
      },
    },
  },
});
