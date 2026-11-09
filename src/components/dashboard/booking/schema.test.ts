import { describe, expect, it } from "vitest";
import { INT4_MAX, manualBookingSchema, parseLei, rpcErrorCode, schemaErrorCode } from "./schema";

const valid = {
  unit_id: "b1000000-0000-4000-8000-000000000001",
  check_in: "2026-11-10",
  check_out: "2026-11-13",
  full_name: "  Ana Popescu ",
  email: "Ana@Exemplu.ro",
  phone: "+40 712 345 678",
  adults: 2,
  children: 0,
  amount: "450,50",
};

function code(input: unknown) {
  const r = manualBookingSchema.safeParse(input);
  return r.success ? "ok" : schemaErrorCode(r.error);
}

describe("parseLei", () => {
  it.each([
    ["450,50", 45050],
    ["450", 45000],
    ["1.234,50", 123450],
    ["450.50", 45050],
    ["450,5", 45050],
    ["1 234,50", 123450],
    ["0", 0],
    ["", 0],
    ["21474836,47", INT4_MAX],
    ["1.234.567", 123456700],
    ["1.500,00", 150000],
  ])("%s -> %d bani", (raw, bani) => expect(parseLei(raw)).toBe(bani));

  it.each(["450,505", "-1", "abc", "21474836,48", "99999999999", "1,234.50", "1.23.4", "4,", ",5", "1e5", "+5", "450.505", "1.500"])(
    "refuses %s",
    (raw) => expect(parseLei(raw)).toBeNull(),
  );
});

describe("manualBookingSchema", () => {
  it("parses a valid booking, trims and converts lei to bani", () => {
    const r = manualBookingSchema.parse(valid);
    expect(r.full_name).toBe("Ana Popescu");
    expect(r.email).toBe("ana@exemplu.ro");
    expect(r.amount).toBe(45050);
  });

  it("is strict: organization_id, status or source are refused", () => {
    expect(code({ ...valid, organization_id: "a1000000-0000-4000-8000-000000000001" })).toBe("invalid_input");
    expect(code({ ...valid, status: "hold" })).toBe("invalid_input");
    expect(code({ ...valid, source: "booking" })).toBe("invalid_input");
  });

  it("checks guests", () => {
    expect(code({ ...valid, adults: 0 })).toBe("invalid_guest");
    expect(code({ ...valid, adults: 21 })).toBe("invalid_guest");
    expect(code({ ...valid, adults: 1.5 })).toBe("invalid_guest");
    expect(code({ ...valid, children: -1 })).toBe("invalid_guest");
    expect(code({ ...valid, children: 21 })).toBe("invalid_guest");
    expect(code({ ...valid, adults: "3" })).toBe("ok");
    expect(code({ ...valid, full_name: "   " })).toBe("invalid_guest");
    expect(code({ ...valid, full_name: "x".repeat(81) })).toBe("invalid_guest");
    expect(code({ ...valid, full_name: "Ana\nPopescu" })).toBe("invalid_guest");
    expect(code({ ...valid, full_name: "Ana\u0000" })).toBe("invalid_guest");
    expect(code({ ...valid, full_name: "Ștefan Țăranu" })).toBe("ok");
    expect(code({ ...valid, phone: "1".repeat(33) })).toBe("invalid_guest");
    expect(code({ ...valid, email: "not-an-email" })).toBe("invalid_guest");
    expect(code({ ...valid, email: "" })).toBe("ok");
    expect(code({ ...valid, email: undefined, phone: undefined })).toBe("ok");
  });

  it("checks dates: check_out after check_in, at most 366 nights, real dates", () => {
    expect(code({ ...valid, check_out: valid.check_in })).toBe("invalid_dates");
    expect(code({ ...valid, check_out: "2026-11-09" })).toBe("invalid_dates");
    expect(code({ ...valid, check_in: "2026-01-01", check_out: "2027-01-02" })).toBe("ok"); // 366 nights
    expect(code({ ...valid, check_in: "2026-01-01", check_out: "2027-01-03" })).toBe("invalid_dates"); // 367
    expect(code({ ...valid, check_in: "2026-02-30" })).toBe("invalid_dates");
  });

  it("checks amount and unit", () => {
    expect(code({ ...valid, amount: "450,505" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: "450.505" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: "1.500" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: "-1" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: "abc" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: "21474836,48" })).toBe("invalid_amount");
    expect(code({ ...valid, amount: 450 })).toBe("invalid_amount");
    expect(code({ ...valid, unit_id: "nope" })).toBe("unit_not_found");
  });
});

describe("rpcErrorCode", () => {
  it("maps Postgres errors to codes, never to raw text", () => {
    expect(rpcErrorCode({ code: "23P01", message: "booking_overlap" })).toBe("booking_overlap");
    expect(rpcErrorCode({ code: "P0002", message: "unit_not_found" })).toBe("unit_not_found");
    expect(rpcErrorCode({ code: "22023", message: "invalid_amount" })).toBe("invalid_amount");
    expect(rpcErrorCode({ code: "22023", message: "something else" })).toBe("invalid_input");
    expect(rpcErrorCode({ code: "42501", message: "permission denied" })).toBe("unauthorized");
    expect(rpcErrorCode({ code: "XX000", message: "internal" })).toBe("generic");
    expect(rpcErrorCode({})).toBe("generic");
  });
});
