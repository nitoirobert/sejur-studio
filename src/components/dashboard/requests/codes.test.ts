import { describe, expect, it } from "vitest";
import { pageFromParam, respondErrorCode, respondSchema, timeLeft } from "./codes";

describe("respondErrorCode", () => {
  it("reads the code the function raised", () => {
    expect(respondErrorCode({ code: "P0002", message: "booking_not_found" })).toBe("booking_not_found");
    expect(respondErrorCode({ code: "22023", message: "hold_expired" })).toBe("hold_expired");
    expect(respondErrorCode({ code: "22023", message: "invalid_status" })).toBe("invalid_status");
  });
  it("maps SQLSTATEs without a known message", () => {
    expect(respondErrorCode({ code: "22P02", message: "invalid input syntax for type uuid" })).toBe("booking_not_found");
    expect(respondErrorCode({ code: "42501", message: "permission denied" })).toBe("unauthorized");
    expect(respondErrorCode({ code: "PGRST301", message: "jwt expired" })).toBe("unauthorized");
    expect(respondErrorCode({ code: "XX000", message: "boom" })).toBe("generic");
    expect(respondErrorCode({})).toBe("generic");
  });
});

describe("respondSchema", () => {
  const id = "0b0e4a52-6e0c-4a43-9a6b-6a3f1c2d9e11";
  it("accepts an id and a decision only", () => {
    expect(respondSchema.safeParse({ booking_id: id, decision: "confirm" }).success).toBe(true);
    expect(respondSchema.safeParse({ booking_id: id, decision: "delete" }).success).toBe(false);
    expect(respondSchema.safeParse({ booking_id: "x", decision: "confirm" }).success).toBe(false);
    expect(respondSchema.safeParse({ booking_id: id, decision: "confirm", status: "confirmed" }).success).toBe(false);
  });
});

describe("pageFromParam", () => {
  it("falls back to 1", () => {
    expect(pageFromParam(undefined)).toBe(1);
    expect(pageFromParam("0")).toBe(1);
    expect(pageFromParam("-2")).toBe(1);
    expect(pageFromParam("abc")).toBe(1);
    expect(pageFromParam(["3", "4"])).toBe(3);
    expect(pageFromParam("12")).toBe(12);
  });
});

describe("timeLeft", () => {
  const now = Date.parse("2026-11-09T10:00:00Z");
  it("rounds up to the minute", () => {
    expect(timeLeft("2026-11-10T09:59:30Z", now)).toEqual({ hours: 24, minutes: 0 });
    expect(timeLeft("2026-11-09T11:30:01Z", now)).toEqual({ hours: 1, minutes: 31 });
    expect(timeLeft("2026-11-09T10:00:20Z", now)).toEqual({ hours: 0, minutes: 1 });
  });
  it("is null once past", () => {
    expect(timeLeft("2026-11-09T10:00:00Z", now)).toBeNull();
    expect(timeLeft("2026-11-09T09:59:00Z", now)).toBeNull();
    expect(timeLeft("garbage", now)).toBeNull();
  });
});
