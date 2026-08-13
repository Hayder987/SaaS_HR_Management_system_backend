
import { z } from "zod";

 const createPlanZodSchema = z.object({
  name: z.enum([
    "BASIC",
    "GOLD",
    "DIAMOND",
    "PLATINUM",
  ]),

  price: z
    .number()
    .nonnegative("Price cannot be negative"),

  maxAdmins: z
    .number()
    .int()
    .positive("Maximum admins must be greater than 0"),

  maxHRs: z
    .number()
    .int()
    .positive("Maximum HRs must be greater than 0"),

  maxEmployees: z
    .number()
    .int()
    .positive("Maximum employees must be greater than 0"),
});


// export plan zodSchema 

export const planValidation = {
    createPlanZodSchema
}