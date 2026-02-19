import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

describe("requireAuth middleware", () => {
  it("returns 401 when missing token", async () => {
    const { requireAuth } = await import("./auth.js");
    const app = express();
    app.get("/protected", requireAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    process.env.JWT_ACCESS_SECRET = "access-secret";
    jest.resetModules();
    const { requireAuth } = await import("./auth.js");
    const app = express();
    app.get("/protected", requireAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid");

    expect(response.status).toBe(401);
  });

  it("allows request with valid token", async () => {
    process.env.JWT_ACCESS_SECRET = "access-secret";
    jest.resetModules();
    const { requireAuth } = await import("./auth.js");
    const token = jwt.sign({ sub: "user-1", username: "admin" }, "access-secret", {
      expiresIn: "15m",
    });
    const app = express();
    app.get("/protected", requireAuth, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });

  it("supports injected tokenService", async () => {
    const { createRequireAuth } = await import("./auth.js");
    const verifyAccessToken = jest.fn(() => ({
      sub: "injected-user",
      username: "injected-name",
    }));
    const requireAuth = createRequireAuth({
      tokenService: { verifyAccessToken },
    });
    const req = {
      headers: { authorization: "Bearer injected-token", cookie: "" },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      end: jest.fn(),
    };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(verifyAccessToken).toHaveBeenCalledWith("injected-token");
    expect(req.user).toEqual({
      id: "injected-user",
      username: "injected-name",
    });
    expect(next).toHaveBeenCalled();
  });
});
