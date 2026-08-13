import { z } from "zod";

export interface IRegisterUser {
  name: string;
  email: string;
  password: string;
}

 const registerUserZodSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(70, "Name must not exceed 100 characters"),

  email: z.email("Please provide a valid email address"),

  password: z
    .string()
    .min(6, "Password Must Minimum 6 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
});

export const authValidation = {
    registerUserZodSchema
}
