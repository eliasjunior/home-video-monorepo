import config from "../config";

const { SERVER_URL } = config();

export function getCookie(name) {
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch (err) {
    return {};
  }
}

export async function login({ username, password }) {
  const res = await fetch(`${SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return { status: res.status, ...body };
}

export async function refreshTokens() {
  const csrf = getCookie("csrf_token");
  const res = await fetch(`${SERVER_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf || "",
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return res.ok && !body.error;
}

export async function logout() {
  const csrf = getCookie("csrf_token");
  const res = await fetch(`${SERVER_URL}/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrf || "",
    },
    body: JSON.stringify({}),
    credentials: "include",
  });
  return { status: res.status };
}
