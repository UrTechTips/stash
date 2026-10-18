import { defineConfig } from 'vitest/config';

// Pure-logic and database tests (engine, money, repositories, services). Component tests run in Jest.
export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts', 'src/engine/**/*.test.ts', 'src/db/**/*.test.ts', 'src/services/**/*.test.ts'],
  },
});
