import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { authValidation } from "./auth.validation";

const router = Router();

// register user
router.post(
  "/register",
  validateRequest(authValidation.registerUserZodSchema),
  authController.registerUser,
);

export const authRoutes = router;
