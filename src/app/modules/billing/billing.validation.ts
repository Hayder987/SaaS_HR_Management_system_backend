import z from "zod";

export const createCheckoutValidationSchema = z.object({
  planId: z.string().uuid(),
});
