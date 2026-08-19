import { Router } from "express";

import { billingController } from "./billing.controller";
import { auth } from "../../middleware/auth";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

// =====================================================
// AUTHENTICATED BILLING ROUTES
// =====================================================

router.post(
  "/checkout",
  auth(UserRole.PLATFORM_USER),
  billingController.createCheckoutSession,
);

router.post("/webhook", billingController.stripeWebhook);

router.get(
  "/subscription",
  auth(UserRole.PLATFORM_USER),
  billingController.getSubscriptionStatus,
);

export const billingRoutes = router;
