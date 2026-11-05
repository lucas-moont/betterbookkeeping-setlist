import { test, expect, type Page } from "@playwright/test";

type CapturedResponse = { url: string; body: string };

/**
 * Records the body of every response the browser receives, so a test can
 * assert that no server secret ever reaches the client.
 * Returns a function that resolves to everything captured so far.
 */
function recordResponses(page: Page) {
  const pending: Promise<CapturedResponse | null>[] = [];
  page.on("response", (response) => {
    pending.push(
      response
        .text()
        .then((body) => ({ url: response.url(), body }))
        // Redirects and aborted requests have no body to read.
        .catch(() => null),
    );
  });
  return async () => (await Promise.all(pending)).filter((r): r is CapturedResponse => r !== null);
}

function urlsWhoseBodyIncludes(responses: CapturedResponse[], needle: string) {
  return responses.filter((r) => r.body.includes(needle)).map((r) => r.url);
}

test.describe("Server secrets", () => {
  test("signed-out navigation never sends the database URL to the browser", async ({ page }) => {
    const capturedResponses = recordResponses(page);

    await page.goto("/sign-in");
    // A client-side navigation runs the root beforeLoad in the browser,
    // which turns its server function calls into network requests.
    await page.getByRole("link", { name: "Create one" }).click();
    await expect(page).toHaveURL(/\/create-account$/);
    await page.waitForLoadState("networkidle");

    expect(urlsWhoseBodyIncludes(await capturedResponses(), "postgresql://")).toEqual([]);
  });

  test("signed-in navigation never sends a password or the database URL to the browser", async ({ page }) => {
    const password = "correct-horse-battery";
    const capturedResponses = recordResponses(page);

    await page.goto("/create-account");
    // Filling before hydration loses the input: React resets controlled fields.
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name").fill("Secrets Check");
    await page.getByLabel("Email").fill(`e2e-secrets-${Date.now()}@example.com`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Logged in as")).toBeVisible();

    // Client-side navigations: the user comes back through server function calls.
    await page.getByRole("link", { name: "Movements" }).click();
    await expect(page).toHaveURL(/\/movements$/);
    await page.getByRole("link", { name: "Workout History" }).click();
    await expect(page).toHaveURL(/\/workout-history$/);
    // Full page load: the user comes back inside the server-rendered HTML.
    await page.goto("/movements");
    await page.waitForLoadState("networkidle");

    const captured = await capturedResponses();
    // The value the user typed must not come back in any response, whatever the channel.
    expect(urlsWhoseBodyIncludes(captured, password)).toEqual([]);
    // Only server function payloads for the key: the HTML legitimately says "Password".
    const serverFnResponses = captured.filter((r) => r.url.includes("/_serverFn/"));
    expect(urlsWhoseBodyIncludes(serverFnResponses, '"password"')).toEqual([]);
    expect(urlsWhoseBodyIncludes(captured, "postgresql://")).toEqual([]);
  });
});
