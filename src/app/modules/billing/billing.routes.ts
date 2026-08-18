import { Router } from "express";
import { createCheckoutValidationSchema } from "./billing.validation";
import { auth } from "../../middleware/auth";
import { UserRole } from "../../../generated/prisma/enums";
import { billingController } from "./billing.controller";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

// =====================================================
// CREATE CHECKOUT
// =====================================================

router.post(
  "/checkout",
  auth(UserRole.PLATFORM_USER),
  validateRequest(createCheckoutValidationSchema),
 billingController.createCheckoutSession,
);

// =====================================================
// STRIPE WEBHOOK
// =====================================================

router.post(
  "/webhook",

  billingController.stripeWebhook,
);

export const billingRoutes = router;
