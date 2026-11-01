import { createStore } from "./store.js";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const store = createStore();
const dir = resolve(process.env.DATA_DIR ?? "data", "backups");
mkdirSync(dir, { recursive: true });
const path = resolve(
  dir,
  `deltabase-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
await store.db.backup(path);
store.db.close();
console.log(`备份已保存：${path}`);
