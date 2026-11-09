import { expect, test, type Page } from "@playwright/test";
import { OWNER1_STATE, OWNER2_STATE, admin, asUser, sessionFromStateFile, watchConsole } from "./support/helpers";
import { OWNER2_PROP } from "./support/chart";
import {
  BUCKET,
  PDF,
  SVG,
  TINY_WEBP,
  bigJpeg,
  deleteE2EProperties,
  fileExists,
  filesIn,
  insertPhoto,
  insertProperty,
  makeJpeg,
  owner1Client,
  owner1Org,
  owner2Org,
  runTag,
  webpSize,
} from "./support/props";

// Brief 04 checks 3 (photos), 4 and 12 (Storage paths). Own "E2E ..." property per test, removed in afterAll.
test.use({ storageState: OWNER1_STATE });
const tag = runTag();
let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = watchConsole(page);
});
test.afterEach(() => {
  expect(errors, "console").toEqual([]);
});
test.afterAll(async () => {
  await deleteE2EProperties();
});

async function photosTab(page: Page, prop: string) {
  await page.goto(`/dashboard/proprietati/${prop}?tab=poze`);
  await page.waitForLoadState("networkidle"); // hydrated: the file input has its change handler
}

test("4: 11 MB, PDF și SVG refuzate cu mesaj înainte de micșorare; nimic nu ajunge în Storage", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Poze refuz ${tag}` });
  await photosTab(page, prop);
  // A resize would call createImageBitmap: count the calls to prove the check runs first.
  await page.evaluate(() => {
    const w = window as unknown as { __bitmaps: number; createImageBitmap: typeof createImageBitmap };
    w.__bitmaps = 0;
    const orig = w.createImageBitmap.bind(window);
    w.createImageBitmap = ((...a: Parameters<typeof createImageBitmap>) => {
      w.__bitmaps++;
      return orig(...a);
    }) as typeof createImageBitmap;
  });
  await page.getByTestId("photo-input").setInputFiles([
    { name: "mare.jpg", mimeType: "image/jpeg", buffer: bigJpeg() },
    { name: "document.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "desen.svg", mimeType: "image/svg+xml", buffer: SVG },
    { name: "pdf-redenumit.jpg", mimeType: "image/jpeg", buffer: PDF },
  ]);
  const box = page.getByTestId("photo-file-errors");
  await expect(box).toContainText("mare.jpg: are peste 10 MB.");
  await expect(box).toContainText("document.pdf: nu e o poză JPG, PNG, WebP sau AVIF.");
  await expect(box).toContainText("desen.svg: nu e o poză JPG, PNG, WebP sau AVIF.");
  await expect(box).toContainText("pdf-redenumit.jpg: nu e o poză JPG, PNG, WebP sau AVIF.");
  await expect(page.getByTestId("photo-staged-item")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __bitmaps: number }).__bitmaps)).toBe(0);
  await page.screenshot({ path: "docs/briefs/04-capturi/poze-refuzate-1440.png" });
  expect(await filesIn(org, prop)).toEqual([]);
});

test("4: același fișier urcat direct în Storage (fără UI) e refuzat de bucket", async () => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Poze bucket ${tag}` });
  const db = owner1Client();
  const at = () => `${org}/${prop}/${crypto.randomUUID()}.webp`;
  const big = await db.storage.from(BUCKET).upload(at(), bigJpeg(), { contentType: "image/jpeg" });
  expect(big.error, "11 MB").not.toBeNull();
  const svg = await db.storage.from(BUCKET).upload(at(), SVG, { contentType: "image/svg+xml" });
  expect(svg.error, "SVG").not.toBeNull();
  const pdf = await db.storage.from(BUCKET).upload(at(), PDF, { contentType: "application/pdf" });
  expect(pdf.error, "PDF").not.toBeNull();
  // Control: a small WebP at a valid path goes through, so the refusals above are the limits.
  const ok = await db.storage.from(BUCKET).upload(at(), TINY_WEBP, { contentType: "image/webp" });
  expect(ok.error).toBeNull();
  expect(await filesIn(org, prop)).toHaveLength(1);
});

test("12: căi refuzate în Storage: altă firmă, altă proprietate, „..”, alt nume decât <uuid>.webp", async () => {
  const org = await owner1Org();
  const org2 = await owner2Org();
  const prop = await insertProperty({ org, name: `Poze cai ${tag}` });
  const db = owner1Client();
  const id = crypto.randomUUID();
  for (const bad of [
    `${org2}/${OWNER2_PROP}/${id}.webp`,
    `${org}/${OWNER2_PROP}/${id}.webp`,
    `${org}/${prop}/../${id}.webp`,
    `${org}/${prop}/sub/${id}.webp`,
    `${org}/${prop}/${id}.jpg`,
    `${org}/${prop}/Poza Mea.webp`,
  ]) {
    const r = await db.storage.from(BUCKET).upload(bad, TINY_WEBP, { contentType: "image/webp" });
    expect(r.error, bad).not.toBeNull();
  }
  expect(await filesIn(org, prop)).toEqual([]);
});

test("4 + 12: JPEG de 4000 px -> WebP de cel mult 2000 px, fără EXIF; la ștergere dispare și fișierul; owner2 nu-l citește", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Poze mari ${tag}` });
  await photosTab(page, prop);
  const jpeg = await makeJpeg(page, 4000, 3000);
  await page.getByTestId("photo-input").setInputFiles({ name: "terasa.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await expect(page.getByTestId("photo-staged-item")).toHaveCount(1);
  // Alt text is required.
  await page.getByTestId("photo-upload-submit").click();
  await expect(page.getByTestId("photo-alt-missing")).toBeVisible();
  await page.getByTestId("photo-staged-alt").fill("Terasa cu vedere spre munte");
  await page.getByTestId("photo-upload-submit").click();
  const card = page.getByTestId("photo-card");
  await expect(card).toHaveCount(1, { timeout: 30_000 });
  await expect(card).toHaveAttribute("data-cover", "true");

  const db = admin();
  const { data: rows } = await db.from("photos").select("id, storage_path, alt, position, is_cover").eq("property_id", prop);
  expect(rows).toHaveLength(1);
  const row = rows![0];
  expect(row.storage_path).toMatch(new RegExp(`^${org}/${prop}/[0-9a-f-]{36}\\.webp$`));
  expect(row).toMatchObject({ alt: "Terasa cu vedere spre munte", position: 0, is_cover: true });
  const { data: blob, error } = await db.storage.from(BUCKET).download(row.storage_path);
  expect(error).toBeNull();
  const buf = Buffer.from(await blob!.arrayBuffer());
  expect(blob!.type).toBe("image/webp");
  const size = webpSize(buf);
  expect(Math.max(size.width, size.height)).toBe(2000);
  expect(size).toEqual({ width: 2000, height: 1500 });
  expect(buf.includes(Buffer.from("EXIF")), "EXIF chunk").toBe(false);
  expect(buf.length).toBeLessThan(jpeg.length);

  // owner2: neither the file nor the folder listing.
  const o2 = asUser(sessionFromStateFile(OWNER2_STATE).access_token);
  const read2 = await o2.storage.from(BUCKET).download(row.storage_path);
  expect(read2.data).toBeNull();
  const list2 = await o2.storage.from(BUCKET).list(`${org}/${prop}`);
  expect(list2.data ?? []).toEqual([]);
  const signed2 = await o2.storage.from(BUCKET).createSignedUrl(row.storage_path, 60);
  expect(signed2.data).toBeNull();

  await card.getByTestId("photo-delete").click();
  await card.getByTestId("photo-delete-confirm").click();
  await expect(page.getByTestId("photo-card")).toHaveCount(0);
  await expect.poll(() => fileExists(row.storage_path)).toBe(false);
  const { data: gone } = await db.from("photos").select("id").eq("id", row.id);
  expect(gone).toEqual([]);
});

test("3: ordinea pozelor rămâne după reîncărcare; coperta e una singură", async ({ page }) => {
  const org = await owner1Org();
  const prop = await insertProperty({ org, name: `Poze ordine ${tag}` });
  const ps: Awaited<ReturnType<typeof insertPhoto>>[] = [];
  for (let i = 0; i < 3; i++) ps.push(await insertPhoto({ org, property: prop, position: i, cover: i === 0 }));
  const ids = ps.map((p) => p.id);
  await photosTab(page, prop);
  await page.waitForLoadState("networkidle");
  const order = () => page.getByTestId("photo-card").evaluateAll((r) => r.map((x) => x.getAttribute("data-photo-id")));
  await expect.poll(order).toEqual(ids);

  // Drag the first card onto the second (same row: a horizontal move that stays in the viewport).
  await page.getByTestId("photo-grid").evaluate((g) => g.scrollIntoView({ block: "start" }));
  const h = (await page.getByTestId("photo-card").nth(0).getByTestId("photo-handle").boundingBox())!;
  const target = (await page.getByTestId("photo-card").nth(1).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 10, h.y + h.height / 2, { steps: 3 });
  await page.mouse.move(target.x + target.width * 0.6, h.y + h.height / 2, { steps: 12 });
  await page.mouse.up();
  const expected = [ids[1], ids[0], ids[2]];
  await expect.poll(order).toEqual(expected);
  await expect(page.getByText("Ordinea e salvată.")).toBeVisible();

  const dbOrder = async () => {
    const { data } = await admin().from("photos").select("id, position, is_cover").eq("property_id", prop).order("position");
    return data!;
  };
  await expect.poll(async () => (await dbOrder()).map((p) => p.id)).toEqual(expected);
  expect((await dbOrder()).map((p) => p.position)).toEqual([0, 1, 2]);
  await page.reload();
  await expect.poll(order).toEqual(expected);

  // Cover: make the third one the cover; exactly one cover afterwards, in the DB and on screen.
  const third = page.locator(`[data-testid="photo-card"][data-photo-id="${ids[2]}"]`);
  await third.getByTestId("photo-make-cover").click();
  await expect(third).toHaveAttribute("data-cover", "true");
  await expect(page.locator('[data-testid="photo-card"][data-cover="true"]')).toHaveCount(1);
  await expect(page.getByTestId("photo-cover-badge")).toHaveCount(1);
  await expect.poll(async () => (await dbOrder()).filter((p) => p.is_cover).map((p) => p.id)).toEqual([ids[2]]);
  await page.reload();
  await expect(page.locator('[data-testid="photo-card"][data-cover="true"]')).toHaveAttribute("data-photo-id", ids[2]);

  // Deleting the cover: one new cover, positions 0..n-1.
  await third.getByTestId("photo-delete").click();
  await third.getByTestId("photo-delete-confirm").click();
  await expect(page.getByTestId("photo-card")).toHaveCount(2);
  await expect.poll(async () => (await dbOrder()).map((p) => [p.position, p.is_cover])).toEqual([
    [0, true],
    [1, false],
  ]);
  await expect.poll(() => fileExists(ps[2].path)).toBe(false);
});
