import express from "express";
import fs from "fs";
import path from "path";
import { logE } from "../common/MessageUtil";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ users: {} }, null, 2));
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(PROGRESS_FILE, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    logE("Failed to parse progress store. Resetting.", err);
    return { users: {} };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(store, null, 2));
}

export function createProgressRouter() {
  const router = express.Router();

  router.get("/progress/:videoId", (req, res) => {
    const { videoId } = req.params;
    const userId = req.user?.id;
    if (!userId || !videoId) {
      return res.status(400).json({ message: "Missing user or videoId" }).end();
    }

    const store = readStore();
    const record = store.users?.[userId]?.[videoId];
    if (!record) {
      return res.status(404).json({ message: "Progress not found" }).end();
    }
    return res.status(200).json(record).end();
  });

  router.post("/progress", (req, res) => {
    const userId = req.user?.id;
    const { videoId, positionSeconds, durationSeconds } = req.body || {};
    if (!userId || !videoId) {
      return res.status(400).json({ message: "Missing user or videoId" }).end();
    }
    const position = Number(positionSeconds);
    const duration =
      durationSeconds === undefined ? undefined : Number(durationSeconds);
    if (!Number.isFinite(position) || position < 0) {
      return res.status(400).json({ message: "Invalid positionSeconds" }).end();
    }
    if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
      return res.status(400).json({ message: "Invalid durationSeconds" }).end();
    }

    const store = readStore();
    if (!store.users) store.users = {};
    if (!store.users[userId]) store.users[userId] = {};
    const record = {
      videoId,
      positionSeconds: position,
      durationSeconds: duration,
      updatedAt: new Date().toISOString(),
    };
    store.users[userId][videoId] = record;
    writeStore(store);

    return res.status(200).json(record).end();
  });

  return router;
}
