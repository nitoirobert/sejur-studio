import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { NEW_USER_STATE, OWNER1_STATE } from "./support/helpers";

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Check 12: Secure + SameSite=Lax in production; only URL + anon key are public; no admin key name in src/ or e2e/ (brief: grep -rn on src/ e2e/).
test("cookie-urile sb-* sunt Secure + SameSite=Lax (build de producție)", () => {
  const files = [OWNER1_STATE, NEW_USER_STATE].filter((f) => fs.existsSync(f));
  // No silent pass: the owner1 session written by auth.setup.ts must always be checked.
  expect(files, "storage state files checked").toContain(OWNER1_STATE);
  for (const file of files) {
    const { cookies } = JSON.parse(fs.readFileSync(file, "utf8")) as {
      cookies: { name: string; secure: boolean; sameSite: string; path: string }[];
    };
    const sb = cookies.filter((c) => c.name.startsWith("sb-"));
    expect(sb.length, file).toBeGreaterThan(0);
    for (const c of sb) {
      expect(c.secure, c.name).toBe(true);
      expect(c.sameSite, c.name).toBe("Lax");
      expect(c.path).toBe("/");
    }
  }
});

// The pattern is built from parts so this file does not match itself.
const ADMIN_NAME = new RegExp(["service", "role"].join("_") + "|" + ["SERVICE", "ROLE"].join("_"));

test("grep după numele cheii admin în src/ și e2e/ e gol", () => {
  const hits: string[] = [];
  for (const f of [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "e2e"))]) {
    if (f.includes(`${path.sep}__screenshots__${path.sep}`)) continue;
    const text = fs.readFileSync(f, "utf8");
    text.split(/\r?\n/).forEach((line, i) => {
      if (ADMIN_NAME.test(line)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`);
    });
  }
  expect(hits).toEqual([]);
});

test("pachetele trimise browserului nu conțin cheia admin; env public = doar URL, anon, site", () => {
  const adminKey = process.env.SUPABASE_ADMIN_KEY;
  expect(adminKey).toBeTruthy();
  const staticDir = path.join(ROOT, ".next", "static");
  // The suite runs against `npm run start`, so a production build must exist; no skip.
  expect(fs.existsSync(staticDir), "production build in .next/static").toBe(true);
  expect(walk(staticDir).filter((x) => x.endsWith(".js")).length).toBeGreaterThan(0);
  for (const f of walk(staticDir).filter((x) => /\.(js|css|html|json)$/.test(x))) {
    const text = fs.readFileSync(f, "utf8");
    expect(text.includes(adminKey!), f).toBe(false);
  }
  const names = new Set<string>();
  for (const f of walk(path.join(ROOT, "src"))) {
    for (const m of fs.readFileSync(f, "utf8").matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) names.add(m[0]);
  }
  expect([...names].sort()).toEqual(
    [...names].filter((n) => ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SITE_URL"].includes(n)).sort(),
  );
});
