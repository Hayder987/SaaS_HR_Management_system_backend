import { z } from "zod";

export interface IRegisterUser {
  name: string;
  email: string;
  password: string;
}

export const registerUserZodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(255, "Email cannot exceed 255 characters"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/,
      "Password must contain uppercase, lowercase, number and special character",
    ),
});

// verify EmailSchema
export const verifyEmailZodSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),

  otp: z
    .string()
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only numbers"),
});

// forgotPasswordSchema
const forgotPasswordZodSchema = z.object({
  email: z.email("Enter Valid Email"),
});

// reset Pass Zod Schema
const ResetPasswordZodSchema = z.object({
  email: z.email(),
  newPassword: z
    .string()
    .min(8, "Password Must Minimum 8 Characters Long.")
    .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
    .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

    .regex(/[0-9]/, "Password must contain atleast 1 Number")
    .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
  otp: z.string().length(6),
});

// resend OTP Schema
const resendOtpZodSchema = z.object({
  email: z.email("Invalid email address"),

  emailVerify: z.boolean(),
});

// export schema
export const authValidation = {
  registerUserZodSchema,
  forgotPasswordZodSchema,
  ResetPasswordZodSchema,
  verifyEmailZodSchema,
  resendOtpZodSchema,
};
