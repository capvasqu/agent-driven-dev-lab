import { defineConfig } from 'vitest/config';

// Vitest is scaffolded for Stage 4. No test files exist yet; `vitest run`
// is a no-op pass until tests are authored.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
