import { rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createGrowthStore } from "../server/growth-store";
import { lead } from "./growth-fixtures";
import { createStore } from "../server/store";
import { feed, metadata } from "./fixtures";
import type { Source } from "../server/apple";
const dir = resolve("test-results/e2e-data");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const s = createStore(resolve(dir, "deltabase.sqlite"));
const prior = new Date(Date.now() - 86400000).toISOString();
const now = new Date().toISOString();
for (const market of ["us", "cn"] as const) {
  const src = s.one<Source>(
    "SELECT * FROM sources WHERE id=?",
    `${market}:6007:free`,
  )!;
  s.saveFeed(
    src,
    feed(
      Array.from({ length: 15 }, (_, i) => String(i + 1)),
      prior,
    ),
    prior,
  );
  s.saveFeed(src, feed(["15", "1", "2", "99"], now), now);
  s.saveFeed(
    s.one<Source>(
      "SELECT * FROM sources WHERE id=?",
      `${market}:6007:grossing`,
    )!,
    feed(["2", "777"], now),
    now,
  );
  for (const id of ["15", "1", "2", "99", "777"])
    s.saveMetadata(id, market, metadata(id));
}
createGrowthStore(s).save(lead(), "baseline");
s.db.close();
