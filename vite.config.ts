import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the built app works from any folder or link.
  base: './',
  build: {
    // three.js alone is about 500 kB; the default warning limit is not useful here.
    chunkSizeWarningLimit: 800,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
