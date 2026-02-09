import request from "supertest";
import app from "../../server.js";

describe("Health", () => {
  it("GET /health returns ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
