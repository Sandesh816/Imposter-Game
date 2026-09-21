import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
test('sync publishes usable root datasets and the legacy module dependencies', () => {
  execFileSync(process.execPath, ['scripts/sync-legacy-assets.mjs']);
  for (const [file, global] of [['categories.js', 'CATEGORIES'], ['questionCategories.js', 'QUESTION_CATEGORIES']]) {
    expect(existsSync(`public/${file}`), `${file} must be published at the homepage URL`).toBe(true);
    const value = vm.runInNewContext(`${readFileSync(`public/${file}`, 'utf8')}\n${global}`);
    expect(Object.keys(value).length).toBeGreaterThan(0);
  }
  for (const file of ['voice.js', 'fx.js']) expect(existsSync(`public/legacy/${file}`)).toBe(true);
});
