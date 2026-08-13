import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";
import { authRateLimiter } from "../../middleware/authRateLimiter";

const router = Router();

// register user
router.post(
  "/register",
  authRateLimiter,
  validateRequest(authValidation.registerUserZodSchema),
  authController.registerUser,
);

export const authRoutes = router;
