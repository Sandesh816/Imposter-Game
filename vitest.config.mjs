import { defineConfig } from 'vitest/config';
// Integration files share one explicitly isolated demo database.
export default defineConfig({test:{fileParallelism:false}});
