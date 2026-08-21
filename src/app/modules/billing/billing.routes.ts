import { Router } from "express";

import { billingController } from "./billing.controller";

import { auth } from "../../middleware/auth";

import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

// =====================================================
// CREATE ORGANIZATION + CHECKOUT
// =====================================================

router.post(
  "/checkout",
  auth(UserRole.PLATFORM_USER),
  billingController.createCheckoutSession,
);

// =====================================================
// STRIPE WEBHOOK
// IMPORTANT: No auth middleware
// =====================================================

router.post("/webhook", billingController.stripeWebhook);

// =====================================================
// CANCEL SUBSCRIPTION
// =====================================================

router.post(
  "/subscription/cancel",
  auth(UserRole.PLATFORM_USER),
  billingController.cancelSubscription,
);

// =====================================================
// GET SUBSCRIPTION
// =====================================================

router.get(
  "/subscription",
  auth(UserRole.PLATFORM_USER),
  billingController.getSubscriptionStatus,
);

export const billingRoutes = router;
