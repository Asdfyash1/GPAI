import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("landing page loads and has CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Forge/);
    const cta = page.locator("text=Get started");
    await expect(cta).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });
});
