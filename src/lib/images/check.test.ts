import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, checkImageFile, sniff } from "./check";
import { fitWithin } from "./resize";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const WEBP = [...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8 ")];
const AVIF = [0, 0, 0, 0x20, ...Buffer.from("ftypavif"), 0, 0, 0, 0];
const PDF = [...Buffer.from("%PDF-1.7\n%")];
const SVG = [...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">')];

const file = (bytes: number[], type: string, size?: number) => {
  const blob = new Blob([new Uint8Array(bytes)], { type });
  if (size === undefined) return blob;
  // A large file without allocating it: only size is read before refusing.
  return { size, type, slice: blob.slice.bind(blob) };
};

describe("sniff", () => {
  it("recognises the four bucket types", () => {
    expect(sniff(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniff(new Uint8Array(PNG))).toBe("image/png");
    expect(sniff(new Uint8Array(WEBP))).toBe("image/webp");
    expect(sniff(new Uint8Array(AVIF))).toBe("image/avif");
  });
  it("refuses PDF, SVG and short input", () => {
    expect(sniff(new Uint8Array(PDF))).toBeNull();
    expect(sniff(new Uint8Array(SVG))).toBeNull();
    expect(sniff(new Uint8Array([0xff]))).toBeNull();
  });
});

describe("checkImageFile (before any resize)", () => {
  it("accepts a JPEG", async () => {
    expect(await checkImageFile(file(JPEG, "image/jpeg"))).toBeNull();
  });
  it("refuses 11 MB before looking at the bytes", async () => {
    expect(await checkImageFile(file(JPEG, "image/jpeg", 11 * 1024 * 1024))).toBe("too_big");
    expect(await checkImageFile(file(JPEG, "image/jpeg", MAX_UPLOAD_BYTES))).toBeNull();
  });
  it("refuses a PDF, an SVG and a PDF renamed to .jpg", async () => {
    expect(await checkImageFile(file(PDF, "application/pdf"))).toBe("bad_type");
    expect(await checkImageFile(file(SVG, "image/svg+xml"))).toBe("bad_type");
    expect(await checkImageFile(file(PDF, "image/jpeg"))).toBe("bad_type");
  });
  it("refuses an empty file", async () => {
    expect(await checkImageFile(file([], "image/jpeg"))).toBe("empty");
  });
});

describe("fitWithin", () => {
  it("scales a 4000 px photo to 2000 px on the long side", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
