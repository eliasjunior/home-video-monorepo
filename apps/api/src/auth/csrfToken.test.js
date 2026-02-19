import { generateCsrfToken } from "./csrfToken";

describe("generateCsrfToken", () => {
  it("returns a non-empty hex string token", () => {
    const token = generateCsrfToken();

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(/^[a-f0-9]+$/i.test(token)).toBe(true);
  });
});

