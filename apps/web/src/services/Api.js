import config from "../config";
import { refreshTokens } from "./auth";

const { SERVER_URL } = config();

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch (err) {
    return {};
  }
}

async function doFetch(path, options = {}) {
  const res = await fetch(`${SERVER_URL}/${path}`, {
    credentials: "include",
    ...options,
  });
  const responseBody = await parseJsonSafe(res);
  return {
    status: res.status,
    ...responseBody,
  };
}

async function requestWithAuth(path, options = {}) {
  let response = await doFetch(path, { ...options });

  if (response.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      response = await doFetch(path, { ...options });
    }
  }

  if (response.status === 401) {
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  return response;
}

export async function get(resource) {
  return requestWithAuth(resource);
}

export async function getById(resource, id) {
  return requestWithAuth(`${resource}/${id}`);
}

async function requestBlobWithAuth(path, options = {}) {
  let res = await fetch(`${SERVER_URL}/${path}`, {
    credentials: "include",
    ...options,
  });

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await fetch(`${SERVER_URL}/${path}`, {
        credentials: "include",
        ...options,
      });
    }
  }

  if (res.status === 401) {
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  const blob = await res.blob();
  return { status: res.status, blob };
}

export async function getBlobUrl(path, options = {}) {
  const { blob } = await requestBlobWithAuth(path, options);
  return URL.createObjectURL(blob);
}
