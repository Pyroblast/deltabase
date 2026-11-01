import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Store } from "./store.js";
import { createFundingStore } from "./funding-store.js";
import {
  appendFundingSchema,
  archiveFundingSchema,
  createFundingSchema,
  duplicateFundingSchema,
  FundingError,
  listFundingSchema,
  observationFundingSchema,
  updateFundingSchema,
} from "./funding-validation.js";
export function registerFunding(app: FastifyInstance, store: Store) {
  const funding = createFundingStore(store);
  const id = (params: unknown) =>
    z.object({ id: z.string().min(1).max(150) }).parse(params).id;
  function respond(reply: FastifyReply, run: () => unknown, status = 200) {
    try {
      return reply.code(status).send(run());
    } catch (err) {
      if (err instanceof FundingError)
        return reply
          .code(err.status)
          .send({ error: err.message, code: err.code, ...err.details });
      if (err instanceof z.ZodError)
        return reply
          .code(400)
          .send({
            error: err.issues.map((i) => i.message).join("；"),
            code: "VALIDATION_ERROR",
            issues: err.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          });
      throw err;
    }
  }
  app.get("/api/funding", (req, reply) =>
    respond(reply, () => funding.list(listFundingSchema.parse(req.query))),
  );
  app.get("/api/funding/companies", (req, reply) =>
    respond(reply, () =>
      funding.companies(
        z.object({ q: z.string().max(200).default("") }).parse(req.query).q,
      ),
    ),
  );
  app.post("/api/funding/duplicates", (req, reply) =>
    respond(reply, () => {
      const b = duplicateFundingSchema.parse(req.body);
      return { candidates: funding.duplicates(b.data, b.excludeId) };
    }),
  );
  app.get("/api/funding/:id", (req, reply) =>
    respond(reply, () => funding.detail(id(req.params))),
  );
  app.post("/api/funding", (req, reply) =>
    respond(
      reply,
      () => funding.create(createFundingSchema.parse(req.body)),
      201,
    ),
  );
  app.put("/api/funding/:id", (req, reply) =>
    respond(reply, () =>
      funding.update(id(req.params), updateFundingSchema.parse(req.body)),
    ),
  );
  app.post("/api/funding/:id/evidence", (req, reply) =>
    respond(reply, () =>
      funding.append(id(req.params), appendFundingSchema.parse(req.body)),
    ),
  );
  app.post("/api/funding/:id/archive", (req, reply) =>
    respond(reply, () =>
      funding.archive(id(req.params), archiveFundingSchema.parse(req.body)),
    ),
  );
  app.post("/api/funding/:id/observations", (req, reply) =>
    respond(
      reply,
      () =>
        funding.observe(
          id(req.params),
          observationFundingSchema.parse(req.body),
        ),
      201,
    ),
  );
}
