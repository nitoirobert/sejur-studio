import { describe, expect, it } from "vitest";
import { SLUG_MAX, SLUG_RE, nextSlug, slugify } from "./slug";

describe("slugify", () => {
  it("transliterates Romanian letters (comma-below and cedilla forms)", () => {
    expect(slugify("Casa Ștefăniță")).toBe("casa-stefanita");
    // Cedilla forms (U+0162, U+015F, U+0163) as old keyboards type them.
    expect(slugify("Pensiunea Ţară şi Mâţă")).toBe("pensiunea-tara-si-mata");
    expect(slugify("Vila Îngerilor, Brașov")).toBe("vila-ingerilor-brasov");
  });

  it("collapses punctuation and spaces and trims dashes", () => {
    expect(slugify("  --Casa   @ Mării!! ")).toBe("casa-marii");
    expect(slugify("Ap. 12 / Etaj 3")).toBe("ap-12-etaj-3");
  });

  it("always returns a slug the DB accepts", () => {
    for (const name of ["", "!!!", "a", "Æble Straße", "x".repeat(200), "a ".repeat(100)]) {
      const s = slugify(name);
      expect(s).toMatch(SLUG_RE);
      expect(s.length).toBeGreaterThanOrEqual(3);
      expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    }
    expect(slugify("Æble Straße")).toBe("aeble-strasse");
  });
});

describe("nextSlug", () => {
  it("adds -2, then counts up", () => {
    expect(nextSlug("casa")).toBe("casa-2");
    expect(nextSlug("casa-2")).toBe("casa-3");
    expect(nextSlug("casa-9")).toBe("casa-10");
  });

  it("treats -1 and -0 as part of the name", () => {
    expect(nextSlug("ap-1")).toBe("ap-1-2");
  });

  it("stays within the maximum length", () => {
    const s = nextSlug("a".repeat(SLUG_MAX));
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s).toMatch(SLUG_RE);
    expect(s.endsWith("-2")).toBe(true);
  });
});
