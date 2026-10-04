import { describe, expect, it } from "vitest";
import { sitePath } from "./paths";

describe("sitePath (security review L3)", () => {
  it("keeps a path on this site", () => {
    for (const p of ["/notebook", "/quran/2?w=ilm&at=2:32:4", "/roots/علم", "/en/me?tab=account", "/%09/x"]) expect(sitePath(p)).toBe(p);
  });
  it("sends anything else to the account page", () => {
    for (const p of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r//evil.com", " /x", "/x y", "/\u00a0/evil.com", "/\u2028x", "https://evil.com", "", null, undefined, 5, `/${"a".repeat(300)}`]) expect(sitePath(p), String(p)).toBe("/me");
  });
});
