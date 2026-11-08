import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { loadTestEnv } from "./e2e/support/env";

loadTestEnv();

// Session files and traces hold live tokens: keep them out of the repo.
export const OUT_DIR = process.env.E2E_OUT_DIR ?? path.join(os.tmpdir(), "sejur-e2e");
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const PORT = new URL(BASE_URL).port || "3100";

// Robert's cookie dialog (src/components/CookieConsent.tsx) dims the page 2 s after load and catches clicks.
// Every context starts with the "necessary only" choice, same shape as saveConsent() in src/lib/consent.ts.
// The setup project inherits it, so the owner session files carry it too.
const CONSENT_STATE = path.join(OUT_DIR, "consent-state.json");
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  CONSENT_STATE,
  JSON.stringify({
    cookies: [
      {
        name: "sejur_consent",
        value: encodeURIComponent(JSON.stringify({ analytics: false, marketing: false, date: "2026-11-09T00:00:00.000Z", v: 1 })),
        domain: new URL(BASE_URL).hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 182,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ],
    origins: [],
  }),
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: path.join(OUT_DIR, "results"),
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  // One worker: the cloud auth rate limit (30 / 5 min) and the shared seed accounts.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: path.join(OUT_DIR, "report"), open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "ro-RO",
    storageState: CONSENT_STATE,
    timezoneId: "Europe/Bucharest",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Production server (`npm run build && npm run start`); reuse it when it already runs.
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `${BASE_URL}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /cleanup\.teardown\.ts/ },
    {
      name: "app",
      testMatch: /\d\d-.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    // Check 7: `/` before/after. Baseline: E2E_BASE_URL=<main build> --project=home --update-snapshots.
    {
      name: "home",
      testMatch: /home\.visual\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
