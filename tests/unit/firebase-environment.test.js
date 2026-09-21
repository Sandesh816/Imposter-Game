import { expect, test } from 'vitest';
import { resolveFirebaseEnvironment } from '../../firebase-environment.js';
const production = { projectId: 'real-project' };
test('default initialization preserves the supplied production configuration', () => {
  expect(resolveFirebaseEnvironment({}, production).config).toEqual(production);
});
test('test builds cannot target a real project', () => {
  expect(() => resolveFirebaseEnvironment({ VITE_USE_EMULATORS: '1', VITE_FIREBASE_PROJECT_ID: 'real-project' }, production)).toThrow(/demo/);
});
test('emulator configuration uses a fixed demo project and loopback', () => {
  const result = resolveFirebaseEnvironment({ VITE_USE_EMULATORS: '1', VITE_FIREBASE_PROJECT_ID: 'demo-imposter-review' }, production);
  expect(result.config.projectId).toBe('demo-imposter-review');
  expect(result.host).toBe('127.0.0.1');
  expect(result.config.databaseURL).toContain('demo-imposter-review');
});
