import { Router } from "express";

import { authController } from "./auth.controller";
import { authValidation } from "./auth.validation";

import { validateRequest } from "../../middleware/validateRequest";
import { authRateLimiter } from "../../middleware/authRateLimiter";
import { auth } from "../../middleware/auth";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

// Register
router.post(
  "/register",
  authRateLimiter,
  validateRequest(authValidation.registerUserZodSchema),
  authController.registerUser,
);

// Login
router.post("/login", authController.loginUser);

// Google Login
router.post("/google", authController.googleLogin);

// Verify Email
router.post(
  "/verify-email",
  authRateLimiter,
  validateRequest(authValidation.verifyEmailZodSchema),
  authController.verifyEmail,
);

// Resend Verification OTP
router.post(
  "/resend-otp",
  authRateLimiter,
  validateRequest(authValidation.resendOtpZodSchema),
  authController.resendOtp,
);

// Forgot Password
router.post(
  "/forgot-password",
  authRateLimiter,
  validateRequest(authValidation.forgotPasswordZodSchema),
  authController.forgotPassword,
);

// Reset Password
router.post(
  "/reset-password",
  authRateLimiter,
  validateRequest(authValidation.ResetPasswordZodSchema),
  authController.resetPassword,
);

// get my profile
router.get(
  "/me",
  auth(UserRole.PLATFORM_USER, UserRole.SUPER_ADMIN),
  authController.getMyProfile,
);

export const authRoutes = router;
