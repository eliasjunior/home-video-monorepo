import request from "supertest";
import express from "express";
import { createAuthRouter } from "./AuthRouter";
import { createInMemoryRefreshTokenStore } from "../auth/refreshTokenStore";

describe("AuthRouter", () => {
  let app;
  let store;

  beforeEach(() => {
    store = createInMemoryRefreshTokenStore();
    app = express();
    app.use(express.json());
    app.use("/auth", createAuthRouter({ refreshTokenStore: store }));
  });

  function getCookieHeader(response) {
    const raw = response.headers["set-cookie"] || [];
    return raw.map((c) => c.split(";")[0]).join("; ");
  }

  function getCookieValue(response, name) {
    const raw = response.headers["set-cookie"] || [];
    const match = raw.find((c) => c.startsWith(`${name}=`));
    if (!match) return undefined;
    return match.split(";")[0].split("=")[1];
  }

  it("login returns tokens with valid credentials", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const response = await request(app).post("/auth/login").send({
      username,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    const cookieHeader = getCookieHeader(response);
    expect(cookieHeader).toContain("access_token=");
    expect(cookieHeader).toContain("refresh_token=");
    expect(cookieHeader).toContain("csrf_token=");
  });

  it("login returns 401 with invalid credentials", async () => {
    const response = await request(app).post("/auth/login").send({
      username: "bad",
      password: "bad",
    });

    expect(response.status).toBe(401);
  });

  it("refresh returns new tokens for valid refresh token", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const cookies = getCookieHeader(login);
    const csrf = getCookieValue(login, "csrf_token");
    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf || "");

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBeTruthy();
    const cookieHeader = getCookieHeader(response);
    expect(cookieHeader).toContain("refresh_token=");
  });

  it("refresh returns 401 when token is revoked", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const cookies = getCookieHeader(login);
    const csrf = getCookieValue(login, "csrf_token");
    const response1 = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf || "");

    const response2 = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf || "");

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(401);
  });

  it("refresh returns 403 when csrf header is missing for cookie refresh", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const cookies = getCookieHeader(login);
    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookies);

    expect(response.status).toBe(403);
  });

  it("refresh returns 401 when refresh token is not a refresh type", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const response = await request(app).post("/auth/refresh").send({
      refreshToken: login.body.accessToken,
    });

    expect(response.status).toBe(401);
  });

  it("refresh returns 400 when refresh token is missing", async () => {
    const response = await request(app).post("/auth/refresh").send({});
    expect(response.status).toBe(400);
  });

  it("logout revokes refresh token", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const cookies = getCookieHeader(login);
    const csrf = getCookieValue(login, "csrf_token");
    const logout = await request(app)
      .post("/auth/logout")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf || "");

    const refresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", cookies)
      .set("x-csrf-token", csrf || "");

    expect(logout.status).toBe(200);
    expect(refresh.status).toBe(401);
  });

  it("logout returns 403 when csrf header is missing for cookie logout", async () => {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "password";
    const login = await request(app).post("/auth/login").send({
      username,
      password,
    });

    const cookies = getCookieHeader(login);
    const logout = await request(app)
      .post("/auth/logout")
      .set("Cookie", cookies);

    expect(logout.status).toBe(403);
  });

  it("uses injected tokenService for refresh flow", async () => {
    const injectedStore = createInMemoryRefreshTokenStore();
    injectedStore.save({
      jti: "old-jti",
      userId: "user-1",
      expiresAtMs: Date.now() + 60_000,
    });

    const injectedTokenService = {
      issueTokens: jest.fn(() => ({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        jti: "new-jti",
        refreshExpiresAtMs: Date.now() + 3600_000,
      })),
      verifyRefreshToken: jest.fn(() => ({
        sub: "user-1",
        jti: "old-jti",
        type: "refresh",
      })),
    };

    const injectedApp = express();
    injectedApp.use(express.json());
    injectedApp.use(
      "/auth",
      createAuthRouter({
        refreshTokenStore: injectedStore,
        tokenService: injectedTokenService,
      })
    );

    const response = await request(injectedApp)
      .post("/auth/refresh")
      .send({ refreshToken: "provided-token" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ accessToken: "new-access-token" });
    expect(injectedTokenService.verifyRefreshToken).toHaveBeenCalledWith(
      "provided-token"
    );
    expect(injectedTokenService.issueTokens).toHaveBeenCalledWith({
      userId: "user-1",
      username: expect.any(String),
    });
  });
});
