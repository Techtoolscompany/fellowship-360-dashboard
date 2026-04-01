import { expect, test } from "@playwright/test";

test("root route sends unauthenticated users to sign-in", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.locator("body")).toContainText(/Welcome back/i);
});

test("unauthenticated app routes redirect to sign-in with callback", async ({ page }) => {
  await page.goto("/app/contacts");

  await expect(page).toHaveURL(/\/sign-in\?error=unauthorized/);
  await expect(page).toHaveURL(/callbackUrl=%2Fapp%2Fcontacts/);
});

test("legacy conversations route stays grace-first behind auth boundary", async ({
  page,
}) => {
  await page.goto("/app/conversations");

  await expect(page).toHaveURL(/\/sign-in\?error=unauthorized/);
  await expect(page).toHaveURL(/callbackUrl=%2Fapp%2Fconversations/);
});
