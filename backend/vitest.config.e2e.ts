import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Multiple e2e spec files share one MongoDB test database and each may
    // call dropDatabase()/deleteMany() in its own setup/teardown — running
    // files in parallel forks risks one file's cleanup wiping data another
    // file is still using. See the identical rationale for the unit config
    // in vitest.config.ts.
    fileParallelism: false,
  },
});
