export function feed(
  ids: string[],
  updated = "2026-10-31T00:00:00Z",
  category = 6007,
) {
  return {
    feed: {
      updated: { label: updated },
      entry: ids.map((id) => ({
        id: { attributes: { "im:id": id } },
        "im:name": { label: `测试产品 ${id}` },
        "im:artist": { label: "测试开发者" },
        "im:image": [],
        category: { attributes: { "im:id": String(category) } },
        "im:price": { attributes: { amount: "0.00", currency: "USD" } },
        "im:releaseDate": { label: "2025-01-01T00:00:00Z" },
      })),
    },
  };
}
export const metadata = (
  id: string,
  name = `测试产品 ${id}`,
  version = "1.0",
) => ({
  trackId: Number(id),
  wrapperType: "software",
  trackName: name,
  artistName: "测试开发者",
  primaryGenreId: 6007,
  price: 0,
  currency: "USD",
  releaseDate: "2025-01-01T00:00:00Z",
  version,
  description: "测试专用数据，不用于真实产品判断。",
  averageUserRating: 4.6,
  userRatingCount: 123,
});
