import { z } from "zod";

const createFeatureZodSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[A-Z0-9_]+$/,
      "Feature key must contain only uppercase letters, numbers and underscore",
    ),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
});

const updateFeatureZodSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(
      /^[A-Z0-9_]+$/,
      "Feature key must contain only uppercase letters, numbers and underscore",
    )
    .optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

const createPlanZodSchema = z.object({
  name: z.enum(["BASIC", "BUSINESS", "ENTERPRISE"]),
  displayName: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  price: z.number().positive("Price must be greater than 0"),
  currency: z.literal("USD").default("USD"),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("YEARLY"),
  maxAdmins: z.number().int().positive(),
  maxHRs: z.number().int().positive(),
  maxManagers: z.number().int().positive(),
  maxEmployees: z.number().int().positive(),
  maxStorageMB: z.number().int().positive(),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  featureIds: z.array(z.string().uuid()).default([]),
});

const updatePlanZodSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().positive().optional(),
  currency: z.literal("USD").optional(),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).optional(),
  maxAdmins: z.number().int().positive().optional(),
  maxHRs: z.number().int().positive().optional(),
  maxManagers: z.number().int().positive().optional(),
  maxEmployees: z.number().int().positive().optional(),
  maxStorageMB: z.number().int().positive().optional(),
  isPopular: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  featureIds: z.array(z.string().uuid()).optional(),
});

export const planValidation = {
  createFeatureZodSchema,
  updateFeatureZodSchema,
  createPlanZodSchema,
  updatePlanZodSchema,
};
