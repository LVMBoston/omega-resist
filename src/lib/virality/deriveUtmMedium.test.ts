import { describe, it, expect } from "vitest";
import { deriveUtmMedium } from "./deriveUtmMedium";

describe("deriveUtmMedium", () => {
  it("maps exact-match channel keywords", () => {
    expect(deriveUtmMedium({ utm_id: "email" })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "mail" })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "em" })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "sms" })).toBe("sms");
    expect(deriveUtmMedium({ utm_id: "text" })).toBe("sms");
    expect(deriveUtmMedium({ utm_id: "qr" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "qrcode" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "fb" })).toBe("fb");
    expect(deriveUtmMedium({ utm_id: "facebook" })).toBe("fb");
    expect(deriveUtmMedium({ utm_id: "x" })).toBe("x");
    expect(deriveUtmMedium({ utm_id: "linkedin" })).toBe("li");
    expect(deriveUtmMedium({ utm_id: "bluesky" })).toBe("bs");
    expect(deriveUtmMedium({ utm_id: "social" })).toBe("social");
    expect(deriveUtmMedium({ utm_id: "p2p" })).toBe("p2p");
  });

  it("matches real-world utm_id samples via substring rules", () => {
    // Samples taken from current production events_actions.utm_id values.
    expect(deriveUtmMedium({ utm_id: "rs1-text" })).toBe("sms");
    expect(deriveUtmMedium({ utm_id: "tst-mail" })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "rs1-mail" })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "tst-text" })).toBe("sms");
    expect(deriveUtmMedium({ utm_id: "rsg1_qr" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "rsg1-qr" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "sts_qr" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "rs1__qr" })).toBe("qr");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(deriveUtmMedium({ utm_id: "  EMAIL  " })).toBe("em");
    expect(deriveUtmMedium({ utm_id: "TST-MAIL" })).toBe("em");
  });

  it("falls back to qr for unclassifiable or missing utm_id", () => {
    expect(deriveUtmMedium({ utm_id: "test1" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "nk3" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "qa" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: "" })).toBe("qr");
    expect(deriveUtmMedium({ utm_id: null })).toBe("qr");
    expect(deriveUtmMedium({})).toBe("qr");
  });
});
