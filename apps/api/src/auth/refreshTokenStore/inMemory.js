export function createInMemoryRefreshTokenStore() {
  const store = new Map();

  return {
    save({ jti, userId, expiresAtMs }) {
      store.set(jti, { userId, expiresAtMs });
    },
    get(jti) {
      return store.get(jti);
    },
    delete(jti) {
      store.delete(jti);
    },
  };
}
