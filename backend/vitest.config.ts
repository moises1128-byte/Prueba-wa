import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Integration spec files (Route, Unit, ...) share the same MongoDB database
    // (prueba_test) and each calls dropDatabase() in its own afterAll hook. With
    // vitest's default parallel file execution, one file's dropDatabase()/deleteMany()
    // can race against another file's in-progress assertions against the same shared
    // database, causing intermittent cross-file test failures unrelated to the code
    // under test. Running spec files sequentially eliminates the race. At this
    // project's scale (a handful of integration files) the slowdown is negligible.
    fileParallelism: false,
  },
});
