import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);
export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);

export function parseBody<S extends z.ZodType>(schema: S, req: FastifyRequest): z.infer<S> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.join(".");
    throw badRequest(first ? `${field ? `${field}: ` : ""}${first.message}` : "Invalid request", result.error.issues);
  }
  return result.data;
}

export function sendError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.status(err.status).send({ error: err.message, details: err.details });
  }
  throw err;
}
