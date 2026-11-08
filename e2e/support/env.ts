import fs from "node:fs";
import path from "node:path";

// Reads .env.local (public URL + anon key) and .env.test.local (admin key, e2e only, gitignored).
//
// SUPABASE_ADMIN_KEY (only in .env.test.local):
//   - what: the secret API key of the dev project enqnxbktjwcqydghvenu (Dashboard > Project
//     Settings > API Keys > Secret keys, "sb_secret_..."; the legacy secret JWT works too).
//     It bypasses RLS.
//   - used by: admin() in e2e/support/helpers.ts, for DB asserts (check 1), the seed snapshot
//     (auth.setup.ts) and deleting the e2e+<timestamp>@example.com accounts (cleanup.teardown.ts).
//   - never: in src/, in a NEXT_PUBLIC_ variable, in .env.local or in a commit (.env* is
//     gitignored). 12-cookie-secrete.spec.ts checks the browser bundles do not contain it.
export function loadTestEnv() {
  for (const file of [".env.local", ".env.test.local"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} (see .env.local / .env.test.local)`);
  return v;
}
