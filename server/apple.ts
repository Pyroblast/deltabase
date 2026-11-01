import { z } from "zod";
import type { ChartKind, Entry, Market } from "../shared/catalog.js";

const label = z.object({ label: z.string() });
const rawEntry = z.object({
  id: z.object({
    attributes: z.object({ "im:id": z.string().regex(/^\d+$/) }),
  }),
  "im:name": label,
  "im:artist": label,
  "im:image": z.array(label),
  category: z.object({ attributes: z.object({ "im:id": z.string() }) }),
  "im:price": z
    .object({
      attributes: z.object({ amount: z.string(), currency: z.string() }),
    })
    .optional(),
  "im:releaseDate": label.optional(),
});
const feedSchema = z.object({
  feed: z.object({
    updated: label.optional(),
    entry: z.union([z.array(rawEntry), rawEntry]).optional(),
  }),
});
export type Source = {
  id: string;
  market: Market;
  kind: ChartKind;
  category: number;
  enabled: number;
  status: string;
  last_checked: string | null;
  last_success: string | null;
  error: string | null;
  count: number;
};
export function feedUrl(source: Pick<Source, "market" | "kind" | "category">) {
  const name: Record<ChartKind, string> = {
    free: "topfreeapplications",
    paid: "toppaidapplications",
    grossing: "topgrossingapplications",
  };
  return `https://itunes.apple.com/${source.market}/rss/${name[source.kind]}/limit=100/genre=${source.category}/json`;
}
export function parseFeed(
  raw: unknown,
  source: Pick<Source, "market" | "category">,
) {
  const { feed } = feedSchema.parse(raw);
  const rows = feed.entry
    ? Array.isArray(feed.entry)
      ? feed.entry
      : [feed.entry]
    : [];
  const seen = new Set<string>();
  const entries: Entry[] = rows.map((e, i) => {
    const id = e.id.attributes["im:id"];
    if (seen.has(id)) throw new Error("来源包含重复 App ID，未保存该榜单");
    seen.add(id);
    const category = Number(e.category.attributes["im:id"]);
    if (category !== source.category)
      throw new Error(
        `返回类别 ${category} 与请求类别 ${source.category} 不一致`,
      );
    const amount = e["im:price"]?.attributes.amount;
    return {
      id,
      name: e["im:name"].label,
      developer: e["im:artist"].label,
      icon: e["im:image"].at(-1)?.label ?? "",
      url: `https://apps.apple.com/${source.market}/app/id${id}`,
      category,
      price: amount && Number.isFinite(Number(amount)) ? Number(amount) : null,
      currency: e["im:price"]?.attributes.currency ?? "",
      releaseDate: e["im:releaseDate"]?.label ?? null,
      rank: i + 1,
    };
  });
  const date = feed.updated?.label;
  return {
    entries,
    sourceUpdatedAt:
      date && Number.isFinite(Date.parse(date))
        ? new Date(date).toISOString()
        : null,
  };
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function getJson(url: string): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "application/json",
          "User-Agent": "Deltabase/0.1 (personal research)",
        },
      });
      if (res.status === 429) {
        const header = res.headers.get("retry-after");
        const seconds =
          header && /^\d+$/.test(header)
            ? Number(header)
            : header
              ? Math.max(0, (Date.parse(header) - Date.now()) / 1000)
              : 10;
        if (attempt < 2 && Number.isFinite(seconds) && seconds <= 60) {
          await wait(seconds * 1000);
          continue;
        }
        throw new Error(
          `来源限流，请稍后重试（Retry-After: ${header ?? "未提供"}）`,
        );
      }
      if (!res.ok) {
        if (res.status < 500) throw new Error(`来源返回 HTTP ${res.status}`);
        throw new Error(`临时来源错误 HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      last = err;
      if (err instanceof Error && /HTTP 4|来源限流/.test(err.message)) break;
      if (attempt < 2) await wait(1000 * 2 ** attempt);
    }
  }
  throw last;
}
let lookupChain: Promise<unknown> = Promise.resolve();
let lastLookup = 0;
export function lookup(
  id: string,
  market: Market,
): Promise<Record<string, any>> {
  const task = lookupChain.then(async () => {
    await wait(Math.max(0, 6000 - (Date.now() - lastLookup)));
    lastLookup = Date.now();
    const raw = (await getJson(
      `https://itunes.apple.com/lookup?id=${id}&country=${market}&entity=software`,
    )) as any;
    const result = raw?.results?.find(
      (r: any) => String(r.trackId) === id && r.wrapperType === "software",
    );
    if (!result)
      throw new Error("该 App 在所选地区未返回资料，请检查 App ID 和地区");
    return result;
  });
  lookupChain = task.catch(() => {});
  return task;
}
