# Agents Guide

This document defines how AI agents should interact with this project.
Agents must rely strictly on the provided context and tasks and must not
assume capabilities beyond what is explicitly stated.

---

## Base Context (Monorepo)

- This is a **monorepo** with:
  - `apps/api`: Node.js backend
  - `apps/web`: React frontend
- Project purpose:
  - Hobby / learning project
  - Focused on gradual improvement (“baby steps”).
- Stability and clarity are more important than bleeding-edge features.
- Each app is expected to **run locally** after every change.

---

## Environment Constraints

- Agents:
  - ❌ cannot change Node versions
  - ❌ cannot elevate permissions
  - ❌ cannot change anything before asking permission.
- Human (me):
  - ✅ can run shell commands
  - ✅ can upgrade Node manually
  - ✅ can update and should update files withing the project context, ask confirmation
  - ✅ will paste back logs and errors

Agents must:
- Ask me to run commands when needed
- Provide **exact commands** to run
- Clearly explain why a command is required


## Frontend Context (apps/web)

- This is a **React SPA** (client for the API).
- Stability and clarity are more important than bleeding-edge changes.
- The app is expected to **run locally** after every change.
- Backend authentication uses **JWT access + refresh tokens**.

---

## Next Steps (Agreed)

1. Add an `rclone` `systemd` service on Raspberry Pi so Google Drive mount starts automatically on reboot.
2. Add a backend guard for flat movie ID collisions (same basename) to avoid ambiguous entries.
3. Open and track a PR including backend changes + documentation updates for reproducibility.

