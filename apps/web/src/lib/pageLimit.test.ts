import { describe, expect, it } from "vitest";
import { allow, FRESH, isLoopback, keyOf } from "./pageLimit";

describe("keyOf", () => {
  it("counts an IPv6 address by its /64 and an IPv4 address as itself", () => {
    expect(keyOf("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1:2::/64");
    expect(keyOf("2001:db8:1:2::ffff")).toBe("2001:db8:1:2::/64");
    expect(keyOf("2001:0db8:0001:0002::1")).toBe("2001:db8:1:2::/64");
    expect(keyOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(keyOf("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(keyOf("203.0.113.5")).toBe("203.0.113.5");
    expect(keyOf("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });
});

describe("allow", () => {
  it("lets a key ask as many times as its limit in a minute, then says when to come back", () => {
    const t = 1_000_000;
    expect([1, 2, 3].map(() => allow("k1", 3, t).ok)).toEqual([true, true, true]);
    expect(allow("k1", 3, t + 20_000)).toEqual({ ok: false, retry: 40 });
    expect(allow("k2", 3, t).ok).toBe(true);
    expect(allow("k1", 3, t + 60_000).ok).toBe(true);
  });
});

describe("FRESH", () => {
  it("names the pages that read the API afresh for each question", () => {
    for (const p of ["/search", "/en/search", "/concordance", "/dictionary/علم/texts", "/en/dictionary/x/texts/"]) expect(FRESH.test(p), p).toBe(true);
    for (const p of ["/", "/quran/2", "/dictionary/علم", "/searching", "/roots/علم"]) expect(FRESH.test(p), p).toBe(false);
  });
});

describe("isLoopback", () => {
  it("knows this machine's own addresses, and only those", () => {
    for (const a of ["127.0.0.1", "127.8.0.1", "::1", "::ffff:127.0.0.1", " ::1 "]) expect(isLoopback(a), a).toBe(true);
    for (const a of ["203.0.113.5", "2001:db8::1", "::ffff:203.0.113.5", "10.0.0.1", "172.18.0.4"]) expect(isLoopback(a), a).toBe(false);
  });
});
