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

export async function getCsrfToken() {
  const res = await fetch(`${SERVER_URL}/auth/csrf`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return body;
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

  // Clear Nextcloud credentials from sessionStorage
  sessionStorage.removeItem('nextcloud_username');
  sessionStorage.removeItem('nextcloud_app_password');
  sessionStorage.removeItem('nextcloud_auth_enabled');

  return { status: res.status };
}

export async function checkAuthentication() {
  const res = await fetch(`${SERVER_URL}/auth/check`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return { status: res.status, ...body };
}

export async function getOAuth2Config() {
  const res = await fetch(`${SERVER_URL}/auth/oauth2-config`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return body;
}

export async function getNextcloudConfig() {
  const res = await fetch(`${SERVER_URL}/auth/nextcloud-config`, {
    method: "GET",
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return body;
}

export async function loginWithNextcloud({ username, appPassword }) {
  const res = await fetch(`${SERVER_URL}/auth/login/nextcloud`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, appPassword }),
    credentials: "include",
  });
  const body = await parseJsonSafe(res);
  return { status: res.status, ...body };
}

export async function getNextcloudShares({ username, appPassword, options = {} }) {
  // Use backend proxy to avoid CORS issues
  const res = await fetch(`${SERVER_URL}/auth/nextcloud/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appPassword, options }),
    credentials: "include",
  });

  const body = await parseJsonSafe(res);
  return body;
}

export async function getSharedVideoFiles({ username, appPassword }) {
  // Use backend proxy to avoid CORS issues
  const res = await fetch(`${SERVER_URL}/auth/nextcloud/shared-videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appPassword }),
    credentials: "include",
  });

  const body = await parseJsonSafe(res);
  return body;
}
