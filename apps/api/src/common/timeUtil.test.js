import { parseDurationToMs } from "./timeUtil";

describe("timeUtil.parseDurationToMs", () => {
  it("parses numeric and duration inputs", () => {
    expect(parseDurationToMs(1000)).toBe(1000);
    expect(parseDurationToMs("15m")).toBe(15 * 60 * 1000);
    expect(parseDurationToMs("2h")).toBe(2 * 60 * 60 * 1000);
    expect(parseDurationToMs("30s")).toBe(30 * 1000);
    expect(parseDurationToMs("1d")).toBe(24 * 60 * 60 * 1000);
  });

  it("returns 0 for invalid inputs", () => {
    expect(parseDurationToMs("bad")).toBe(0);
    expect(parseDurationToMs("10w")).toBe(0);
  });
});

