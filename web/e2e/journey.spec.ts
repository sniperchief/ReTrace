import { expect, test, type Page } from "@playwright/test";

/** No page may scroll sideways at phone width. */
async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
}

/** A tiny file with a WebM header: enough for the server to accept it as audio. */
function fakeWebm(): Buffer {
  const data = Buffer.alloc(4000);
  data.set([0x1a, 0x45, 0xdf, 0xa3]);
  return data;
}

test.describe.configure({ mode: "serial" });

test("a new technician sets up, records, shares and tidies up a repair", async ({ page, context }) => {
  // Landing page for signed-out visitors.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every repair should leave a");
  await expectNoSideScroll(page);
  await page.getByRole("link", { name: "Create account" }).click();

  // Sign-up leads into the guided setup.
  await page.locator("#name:visible").fill("Chidi Okeke");
  await page.locator("#email:visible").fill(`chidi-${Date.now()}@example.com`);
  await page.locator("#password:visible").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Who's your first customer?" })).toBeVisible();
  await expectNoSideScroll(page);

  await page.locator("#name:visible").fill("Mama Bisi");
  await page.locator("#phone:visible").fill("0803 123 4567");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: the customer is preselected; leaving and coming back resumes here.
  await expect(page.getByRole("heading", { name: "Add their generator" })).toBeVisible();
  await expect(page.locator("#customerId:visible option:checked")).toHaveText("Mama Bisi");
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page.getByText("Finish setting up")).toBeVisible();
  await page.getByRole("link", { name: "Continue setup" }).click();
  await page.locator("#label:visible").fill("Big Sumec");
  await page.locator("#serviceIntervalMonths:visible").selectOption("1");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: typed notes → review → confirm.
  await expect(page.getByRole("heading", { name: "Record your first repair" })).toBeVisible();
  await page.getByRole("link", { name: "Record a voice note" }).click();
  await page.getByText("Type your notes instead").click();
  await page.locator("#notes:visible").fill("Customer said it won't start. Replaced spark plug, 2500 naira. Total 5000 naira.");
  await page.getByRole("button", { name: "Fill the form from these notes" }).click();
  await expect(page.getByRole("heading", { name: "Check and confirm" })).toBeVisible();
  // The form appears once the notes have filled it; the repair date defaults to today.
  await expect(page.getByText("the form was filled using simple rules")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#repairDate:visible")).not.toHaveValue("");
  await expectNoSideScroll(page);
  await page.getByLabel("I've checked these details against what was actually done.").check();
  await page.getByRole("button", { name: "Confirm and save repair" }).click();

  // Saved: confirmation, WhatsApp share and receipt.
  await expect(page.getByRole("status")).toContainText("Repair saved");
  const share = page.getByRole("link", { name: "Send to customer" });
  await expect(share).toHaveAttribute("href", /^https:\/\/wa\.me\/2348031234567\?text=Hello%20Mama%20Bisi/);
  await page.getByRole("link", { name: "Receipt" }).click();
  await expect(page.getByText("₦5,000").last()).toBeVisible();
  await expectNoSideScroll(page);

  // Home: setup finished, recent work listed; signed-in visitors skip the landing page.
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText("Finish setting up")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Big Sumec/ }).first()).toBeVisible();
  await expectNoSideScroll(page);

  // Offline: a recording is kept on the phone and uploads when the connection returns.
  await page.getByRole("link", { name: "Start a repair" }).click();
  await page.getByRole("link", { name: /Big Sumec/ }).click();
  await expect(page.getByText("Last time")).toBeVisible();
  await context.setOffline(true);
  await page.locator("input[type=file]").first().setInputFiles({ name: "note.webm", mimeType: "audio/webm", buffer: fakeWebm() });
  await expect(page.getByText("saved on this phone")).toBeVisible();
  await expect(page.getByText("1 recording waiting to upload")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText("A saved recording was uploaded")).toBeVisible({ timeout: 30_000 });

  // Customer page: call and WhatsApp.
  await page.goto("/customers");
  await page.getByRole("link", { name: /Mama Bisi/ }).click();
  await expect(page.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+2348031234567");

  // Delete the generator (history included), then the customer.
  await page.getByRole("link", { name: /Big Sumec/ }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete generator" }).click();
  await expect(page.getByText(/Delete this generator and its \d+ records\?/)).toBeVisible();
  await page.getByRole("button", { name: "Delete generator" }).click();
  await expect(page.getByRole("status")).toContainText("Generator and its history deleted");
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Delete customer" }).click();
  await page.getByRole("button", { name: "Delete customer" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByText("No customers yet")).toBeVisible();
});

test("the app can be installed: manifest and icons are public", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  expect(await manifest.json()).toMatchObject({ start_url: "/home", display: "standalone" });
  for (const icon of ["/icon-192.png", "/icon-512.png", "/apple-icon.png", "/icon.svg"]) {
    expect((await request.get(icon)).ok(), icon).toBe(true);
  }
});

test("technicians can switch the interface to Pidgin and back", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText("New to ReTrace?")).toBeVisible();
  await page.getByRole("button", { name: "Language: Pidgin" }).click();
  await expect(page.getByText("You new for ReTrace?")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "pcm");
  await expectNoSideScroll(page);

  // The choice is remembered across pages.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every repair suppose leave");
  await page.getByRole("button", { name: "Language: English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Every repair should leave a");
});
