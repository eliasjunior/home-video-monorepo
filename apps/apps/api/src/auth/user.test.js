import bcrypt from "bcrypt";

describe("user auth", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it("validates credentials with bcrypt hash", async () => {
    jest.resetModules();
    process.env.ADMIN_USERNAME = "admin";
    const hash = await bcrypt.hash("secret", 4);
    process.env.ADMIN_PASSWORD_HASH = hash;
    process.env.ADMIN_PASSWORD = "";

    const { validateCredentials } = await import("./user.js");
    const result = await validateCredentials({
      username: "admin",
      password: "secret",
    });

    expect(result).toBe(true);
  });

  it("rejects invalid password with bcrypt hash", async () => {
    jest.resetModules();
    process.env.ADMIN_USERNAME = "admin";
    const hash = await bcrypt.hash("secret", 4);
    process.env.ADMIN_PASSWORD_HASH = hash;
    process.env.ADMIN_PASSWORD = "";

    const { validateCredentials } = await import("./user.js");
    const result = await validateCredentials({
      username: "admin",
      password: "wrong",
    });

    expect(result).toBe(false);
  });

  it("validates credentials with plaintext fallback", async () => {
    jest.resetModules();
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = "";
    process.env.ADMIN_PASSWORD = "pass";

    const { validateCredentials } = await import("./user.js");
    const result = await validateCredentials({
      username: "admin",
      password: "pass",
    });

    expect(result).toBe(true);
  });

  it("rejects when no password configured", async () => {
    jest.resetModules();
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = "";
    process.env.ADMIN_PASSWORD = "";

    const { validateCredentials } = await import("./user.js");
    const result = await validateCredentials({
      username: "admin",
      password: "any",
    });

    expect(result).toBe(false);
  });
});
