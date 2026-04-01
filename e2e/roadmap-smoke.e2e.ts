import { expect, test } from "@playwright/test";

test("roadmap page loads and shows launch tracking content", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.locator("body")).toContainText(/Roadmap|Launch|GRACE/i);
});
