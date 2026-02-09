import { createInMemoryRefreshTokenStore } from "./inMemory";

describe("inMemoryRefreshTokenStore", () => {
  it("saves, gets and deletes tokens", () => {
    const store = createInMemoryRefreshTokenStore();
    store.save({ jti: "a", userId: "user-1", expiresAtMs: 100 });

    const record = store.get("a");
    expect(record.userId).toBe("user-1");

    store.delete("a");
    expect(store.get("a")).toBeUndefined();
  });
});
