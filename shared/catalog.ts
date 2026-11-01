export const categories = [
  [6000, "商务"],
  [6001, "天气"],
  [6002, "工具"],
  [6003, "旅游"],
  [6004, "体育"],
  [6005, "社交"],
  [6006, "参考"],
  [6007, "效率"],
  [6008, "摄影与录像"],
  [6009, "新闻"],
  [6010, "导航"],
  [6011, "音乐"],
  [6012, "生活"],
  [6013, "健康健美"],
  [6015, "财务"],
  [6016, "娱乐"],
  [6017, "教育"],
  [6018, "图书"],
  [6020, "医疗"],
  [6021, "杂志与报纸"],
  [6022, "目录"],
  [6023, "美食佳饮"],
  [6024, "购物"],
  [6025, "贴纸"],
  [6026, "开发者工具"],
  [6027, "图形与设计"],
] as const;
export type Market = "us" | "cn";
export type ChartKind = "free" | "paid" | "grossing";
export const chartNames: Record<ChartKind, string> = {
  free: "免费榜",
  paid: "付费榜",
  grossing: "畅销榜",
};
export const marketNames = { us: "美国", cn: "中国" };
export const categoryName = (id: number) =>
  categories.find((c) => c[0] === id)?.[1] ?? String(id);
export type Entry = {
  id: string;
  name: string;
  developer: string;
  icon: string;
  url: string;
  category: number;
  price: number | null;
  currency: string;
  releaseDate: string | null;
  rank: number;
};
export type RankedApp = Entry & {
  market: Market;
  kind: ChartKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
  watch: number;
  ignored: number;
  tags: string;
  previousRank: number | null;
  previousAt: string | null;
  snapshotId: number;
  freeAt: string | null;
  freeRank: number | null;
  grossingRank: number | null;
  counterpartAt: string | null;
};
