import { describe, expect, it } from "vitest";
import { showHemistichs } from "./openiti";

const GAP = "\u2003\u2003";

describe("showHemistichs", () => {
  it("draws the hemistich mark as a wide gap and leaves everything else as it is", () => {
    expect(showHemistichs("قال آخر 304 (بطل كأن ثيابه في سرحة % يحذى نعال السبت ليس بتوأم)")).toBe(`قال آخر 304 (بطل كأن ثيابه في سرحة${GAP} يحذى نعال السبت ليس بتوأم)`);
    // half-verses quoted alone
    expect(showHemistichs("303 (هم صلبوا العبدي في جذع نخلة %)")).toBe(`303 (هم صلبوا العبدي في جذع نخلة${GAP})`);
    expect(showHemistichs("307 (% فانظر بمن تثق)")).toBe(`307 (${GAP} فانظر بمن تثق)`);
    expect(showHemistichs("بلا شعر هنا")).toBe("بلا شعر هنا");
    // a percent sign glued to a number is not a hemistich mark
    expect(showHemistichs("نحو 50% من")).toBe("نحو 50% من");
  });
});
