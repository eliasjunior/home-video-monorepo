import { createCorsOptions } from "./corsOptions";

describe("createCorsOptions", () => {
  function resolveOrigin(corsOptions, origin) {
    return new Promise((resolve) => {
      corsOptions.origin(origin, (err, allowed) => {
        resolve({ err, allowed });
      });
    });
  }

  it("allows localhost and private network origins in development", async () => {
    const corsOptions = createCorsOptions({
      appConfig: { corsOrigin: "" },
      env: { NODE_ENV: "development" },
    });

    const local = await resolveOrigin(corsOptions, "http://localhost:3000");
    const lan = await resolveOrigin(corsOptions, "http://192.168.0.10:3000");
    const ten = await resolveOrigin(corsOptions, "http://10.0.0.2:3000");

    expect(local).toEqual({ err: null, allowed: true });
    expect(lan).toEqual({ err: null, allowed: true });
    expect(ten).toEqual({ err: null, allowed: true });
  });

  it("blocks non-allowlisted origins in production", async () => {
    const corsOptions = createCorsOptions({
      appConfig: { corsOrigin: "https://app.example.com" },
      env: { NODE_ENV: "production" },
    });

    const allowed = await resolveOrigin(corsOptions, "https://app.example.com");
    const blocked = await resolveOrigin(corsOptions, "https://evil.example.com");

    expect(allowed).toEqual({ err: null, allowed: true });
    expect(blocked.err).toBeInstanceOf(Error);
    expect(blocked.allowed).toBeUndefined();
  });

  it("allows empty origin (non-browser or same-origin) in any mode", async () => {
    const corsOptions = createCorsOptions({
      appConfig: { corsOrigin: "https://app.example.com" },
      env: { NODE_ENV: "production" },
    });

    const result = await resolveOrigin(corsOptions, undefined);

    expect(result).toEqual({ err: null, allowed: true });
  });
});

