import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Real Postgres round-trips over a real (if local) connection — give
    // them more room than jsdom-only unit tests need.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Command tests share one Postgres connection pool; running files in
    // parallel worker processes would each open their own pool against the
    // same disposable database, which is fine, but keeping it single-
    // threaded makes a failing run's output easy to read top to bottom.
    fileParallelism: false,
  },
});
