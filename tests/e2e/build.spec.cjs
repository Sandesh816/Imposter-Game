const { test, expect } = require('@playwright/test');
test('built homepage loads category datasets and the application', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  for (const asset of ['/categories.js', '/questionCategories.js']) {
    const response = await page.request.get(asset);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).not.toMatch(/^\s*<!doctype html/i);
  }
  expect(await page.evaluate(() => typeof CATEGORIES)).toBe('object');
  expect(await page.evaluate(() => typeof QUESTION_CATEGORIES)).toBe('object');
  await expect(page.locator('#onboarding-screen')).toHaveClass(/active/);
  expect(errors).toEqual([]);
});
