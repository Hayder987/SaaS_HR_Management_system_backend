import z from "zod";
import { catchAsync } from "../utils/catchAsync";
import { NextFunction, Request, Response } from "express";

export const validateRequest = (zodSchema: z.ZodObject) => {
  return catchAsync((req: Request, res: Response, next: NextFunction) => {
    const payload = req.body;

    const result = zodSchema.safeParse(payload);

    const errorZodMessage = result?.error?.issues
      .map((issue) => issue.message)
      .join(", ");

    if (!result.success) {
      throw new Error(errorZodMessage);
    }

    req.body = result.data;

    next();
  });
};
