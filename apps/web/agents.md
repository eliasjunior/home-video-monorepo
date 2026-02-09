# Agents Guide (Frontend)

This document defines how AI agents should interact with the **React frontend** project.
Agents must rely strictly on the provided context and tasks and must not assume
capabilities beyond what is explicitly stated.

---

## Base Context

- This is a **React SPA**.
- Purpose: client for the Home Video API.
- Stability and clarity are more important than bleeding-edge changes.
- The app is expected to **run locally** after every change.
- Backend authentication now uses **JWT access + refresh tokens**.

---

## Environment Constraints

- Agents:
  - ❌ cannot change Node versions
  - ❌ cannot elevate permissions
- Human (me):
  - ✅ can run shell commands
  - ✅ can upgrade Node manually
  - ✅ will paste back logs and errors

Agents must:
- Ask me to run commands when needed
- Provide exact commands to run
- Clearly explain why a command is required

---

## Current Task: E2E Local Validation (Frontend + Backend)

Goal: Verify the React app works end-to-end with the local API and JWT auth.

### Required Info
- API base URL (e.g. `http://localhost:8080`)
- Where to configure API URL (env file or config)
- Auth credentials (username/password)
- Frontend run commands

### E2E Steps (Small, Verifiable)
1. **Install dependencies** and start the React app locally.
2. **Configure API base URL** to the local backend.
3. **Login flow**:
   - Call `/auth/login` from the frontend.
   - Store `accessToken` in memory (not localStorage).
4. **Protected API call**:
   - Ensure API requests include `Authorization: Bearer <accessToken>`.
   - Confirm `/videos` returns data.
5. **Refresh flow**:
   - On `401`, call `/auth/refresh`.
   - Replace access token in memory.
6. **UI verification**:
   - Videos list loads.
   - Series list loads.
   - Player streams a video.
7. Document any issues and the minimal fix.

---

## Completion Criteria

- Frontend loads data from backend locally.
- JWT auth flow works end-to-end (login → access → refresh).
- No blocking console/runtime errors.

---

## Suggested Next Tasks (Frontend)

1. Add a simple auth service module (login/refresh + token storage in memory).
2. Add an API client wrapper with a 401 refresh retry.
3. Add a minimal login UI for manual testing.
4. Add E2E smoke tests (optional).
