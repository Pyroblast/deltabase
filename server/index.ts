import { createStore } from "./store.js";
import { createApp } from "./app.js";
const store = createStore();
const app = await createApp(store, {
  autoSync: process.env.AUTO_SYNC !== "0",
  logger: true,
});
await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 3000) });
console.log(`\n  Δ Deltabase → http://127.0.0.1:${process.env.PORT ?? 3000}\n`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
