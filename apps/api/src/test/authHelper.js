import request from "supertest";
export async function getAuthHeader(app) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin";
  const response = await request(app).post("/auth/login").send({
    username,
    password,
  });

  return `Bearer ${response.body.accessToken}`;
}
