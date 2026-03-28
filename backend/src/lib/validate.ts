import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { ZodError } from "zod";

/**
 * Formats a ZodError into a human-readable list of field errors.
 */
function formatZodError(err: ZodError) {
  return err.issues.map((e) => ({
    field: e.path.map(String).join(".") || "body",
    message: e.message,
  }));
}

/**
 * Middleware factory — validates req.body against a Zod schema.
 * Attaches the parsed (and coerced) value back to req.body on success.
 * Returns HTTP 422 with structured validation errors on failure.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }
    req.body = result.data;
    return next();
  };
}

/**
 * Middleware factory — validates req.query against a Zod schema.
 * Attaches the parsed value back to req.query on success.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(422).json({
        error: "Validation failed",
        details: formatZodError(result.error),
      });
    }
    // @ts-expect-error — deliberately widening the readonly type
    req.query = result.data;
    return next();
  };
}
