import z from "zod";

export const createCheckoutValidationSchema = z.object({
   planId: z.uuid("Invalid plan ID"),

  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must not exceed 100 characters"),

  phone: z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 characters")
    .max(20, "Phone number must not exceed 20 characters"),

  timezone: z
    .string()
    .trim()
    .optional(),
});

export const cancelSubscriptionValidationSchema =
  z.object({
    organizationId: z.uuid(),
  });