import { createInMemoryRefreshTokenStore } from "./index";

describe("refreshTokenStore index", () => {
  it("exports in-memory store creator", () => {
    const store = createInMemoryRefreshTokenStore();
    store.save({ jti: "a", userId: "user-1", expiresAtMs: 100 });

    expect(store.get("a")).toBeTruthy();
  });
});
