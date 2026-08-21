import httpStatus from "http-status";
import { NextFunction, Request, Response } from "express";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { billingService } from "./billing.service";

// =====================================================
// CREATE ORGANIZATION + CHECKOUT SESSION
// =====================================================

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const payload = req.body;

    const result = await billingService.createCheckoutSession(
      userId as string,
      payload,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Organization created and checkout session created successfully",
      data: result,
    });
  },
);

// =====================================================
// STRIPE WEBHOOK
// =====================================================

const stripeWebhook = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const payload = req.body as Buffer;

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Stripe signature is missing",
      });
    }

    await billingService.handleWebhook(payload, signature as string);

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Webhook processed successfully",
      data: null,
    });
  },
);

// =====================================================
// CANCEL SUBSCRIPTION
// =====================================================

const cancelSubscription = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    const { organizationId } = req.body;

    const result = await billingService.cancelSubscription(
      userId as string,
      organizationId,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Subscription canceled successfully",
      data: result,
    });
  },
);

// =====================================================
// GET SUBSCRIPTION STATUS
// =====================================================

const getSubscriptionStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    const { organizationId } = req.query;

    const result = await billingService.getSubscriptionStatus(
      userId as string,
      organizationId as string,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Subscription status retrieved successfully",
      data: result,
    });
  },
);

export const billingController = {
  createCheckoutSession,
  stripeWebhook,
  cancelSubscription,
  getSubscriptionStatus,
};
