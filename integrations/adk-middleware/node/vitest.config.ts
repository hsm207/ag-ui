import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90, // We are effectively 100% locally, but some unresolvable ESM vitest artifacts drop it slightly
        statements: 95
      }
    }
  }
});
