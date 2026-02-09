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
});
