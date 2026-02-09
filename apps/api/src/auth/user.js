import bcrypt from "bcrypt";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export const AUTH_USER = {
  id: "user-1",
  username: ADMIN_USERNAME,
};

export async function validateCredentials({ username, password }) {
  if (!username || !password) return false;
  if (username !== ADMIN_USERNAME) return false;
  if (ADMIN_PASSWORD_HASH) {
    const isValid = Boolean(
      await bcrypt.compare(password, ADMIN_PASSWORD_HASH)
    );
    if (!isValid) {
      console.warn("Invalid credentials: password hash mismatch");
    }
    return isValid;
  }
  if (ADMIN_PASSWORD) {
    console.log("AUTH validateCredentials using ADMIN_PASSWORD");
    const isValid = password === ADMIN_PASSWORD;
    if (!isValid) {
      console.warn("Invalid credentials: password mismatch");
    }
    return isValid;
  }
  console.warn("Invalid credentials: no password configured");
  return false;
}
