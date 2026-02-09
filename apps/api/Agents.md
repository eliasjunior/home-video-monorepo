# Agents Guide

This document defines how AI agents should interact with this project.
Agents must rely strictly on the provided context and tasks and must not
assume capabilities beyond what is explicitly stated.

---

## Base Context

- This is a **Node.js backend application**.
- Project purpose:
  - Hobby / learning project
  - Focused on gradual improvement (“baby steps”).
- Stability and clarity are more important than bleeding-edge features.
- Frontend is **out of scope** unless explicitly mentioned.
- The app is expected to **run locally** after every change.

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
- Provide **exact commands** to run
- Clearly explain why a command is required

---

## Current Context: Dependency Modernization

- `package.json` dependencies are **outdated**.
- The app currently:
  - Runs locally
  - Has no CI/CD pipeline
- Preferred Node.js version:
  - **Latest LTS**, unless compatibility issues arise.
- Goal:
  - Incrementally update dependencies
  - Keep the app running at all times

## Current Context: Auth (Cookie + CSRF)

- The API supports **HttpOnly cookie-based auth** for access + refresh tokens.
- Cookies:
  - `access_token` (HttpOnly, path `/`)
  - `refresh_token` (HttpOnly, path `/auth`)
  - `csrf_token` (readable by JS)
- Access tokens are accepted via `Authorization: Bearer <token>` header or the
  `access_token` cookie.
- CSRF protection is enforced for `/auth/refresh` and `/auth/logout` **only when**
  the refresh token is sent via cookie:
  - The client must send `x-csrf-token` matching the `csrf_token` cookie.
  - If `refreshToken` is provided in the JSON body, CSRF is not required.
- Frontend must send cookies (`credentials: "include"` / `withCredentials: true`).
- Refresh tokens are stored in-memory (adapter pattern) and rotated on refresh.

---

## Task: Update Dependencies Safely

The agent must:

1. Inspect `package.json`
2. Propose **safe upgrade paths**:
   - patch → minor → major (when reasonable)
3. For each upgrade step:
   - Provide exact install/update commands
   - Describe how to test locally
4. If errors occur:
   - Analyze pasted logs
   - Explain the root cause simply
   - Propose the smallest viable fix
5. If a newer Node version is required:
   - Clearly state it
   - Provide the exact command
   - Do NOT assume permission to run it
6. Repeat until:
   - Dependencies are on stable versions
   - App runs locally without errors

---

## Completion Criteria

This task is considered complete when:
- All dependencies are updated to stable versions
- The application starts and runs locally
- No blocking runtime errors remain

Final output must include:
- Summary of updated dependencies
- Known remaining technical debt
- Suggested next small improvement

---

## Context Updates

After task completion:
- This document may be updated
- Context must reflect the **current state only**
- New tasks should be defined separately

Agents must not assume previous context remains valid unless explicitly stated.

---

## Suggested Next Tasks (Testing-First)

1. Add a `smoke` script to run only smoke/health tests.
2. Add a test helper to load `.env.test` safely and avoid config drift.
3. Add unit tests for `RouterUtil.imgProvider` (fallback behavior + image path resolution).
4. Add tests for `StreamingUtilUseCase.getStartEndBytes` edge cases (no range, invalid range).
5. Add tests for `/videos` and `/series` endpoints with mocked file system.
6. Add tests for `FileLib.readDirectory` and `readFile` error behavior.
7. Add a minimal snapshot test for the videos JSON response shape.
8. Set coverage thresholds (start low, e.g. 30%) and gradually increase.

## Suggested Next Tasks (Docker, Baby Steps)

1. Add a `.dockerignore` to reduce build context size.
2. Update `Dockerfile` to a local/dev-friendly base image (align with Node 24).
3. Add a `docker:build` script to build the image locally.
4. Add a short README section on how to run the container locally.

## Suggested Next Tasks (Monorepo, Baby Steps)

Goal: create a new **monorepo** for FE + API while keeping existing repos intact.

1. Create a new repo called `home-video` (empty).
2. Add structure: `apps/api` and `apps/web`.
3. Copy current API into `apps/api` and FE into `apps/web` (no history move).
4. Add root `package.json` with npm workspaces: `["apps/*"]`.
5. Add root scripts to run FE + API together.
6. Update root README with setup/run instructions.
7. Smoke test FE → API from monorepo root.

## Monorepo Follow-Ups (After Initial Move)

1. Install dependencies from monorepo root (`npm install`).
2. Verify root scripts use the correct workspace paths (`apps/api`, `apps/web`).
3. Update FE proxy or API base URL to match monorepo dev setup.
4. Update any CI or docs to run from monorepo root.
5. Optionally add a root `.env.example` to document per-app envs.

---

## Next Task: Add Authentication (JWT)

**Goal**
- Add authentication using JWT.
- Enable refresh tokens that can re-authenticate up to **6 months**.
- Keep the JWT implementation clean and easy to learn from.

**Requirements**
1. Add access + refresh token flow.
2. Access tokens should be short-lived (e.g., minutes).
3. Refresh tokens should be long-lived (up to 6 months).
4. Protect existing routes with authentication (except health and auth endpoints).
5. Provide clear docs/examples for how to login, refresh, and access protected endpoints.
6. Use an injectable refresh token store (adapter pattern).

**Suggested Implementation Steps**
1. Define auth config (token secrets, expirations) and load via env.
2. Add a simple auth user source (hard-coded single user).
3. Create a refresh token store interface (adapter pattern).
4. Implement an in-memory refresh token store adapter.
5. Add auth endpoints:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout` (optional: revoke refresh token)
6. Implement JWT middleware:
   - Verify access token
   - Attach user info to `req.user`
7. Protect existing routes with authentication (exclude `/health` and `/auth/*`).
8. Add tests for:
   - login success/failure
   - access token protected route
   - refresh token rotation/expiry
9. Update README with usage examples and curl commands.

**Chosen Defaults**
- User model: hard-coded single user.
- Refresh token store: in-memory adapter, injectable for future replacement.
- Access token TTL: 15 minutes.
- Refresh token TTL: 180 days.
