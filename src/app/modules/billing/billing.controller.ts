import httpStatus from "http-status";
import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { billingService } from "./billing.service";

// =====================================================
// CREATE CHECKOUT SESSION
// =====================================================

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    const { planId } = req.body;

    const result = await billingService.createCheckoutSession(
      userId as string,
      planId,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Checkout session created successfully",
      data: result,
    });
  },
);

// =====================================================
// STRIPE WEBHOOK
// =====================================================

const stripeWebhook = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const event = req.body as Buffer;
    const signature = req.headers["stripe-signature"]!;

    await billingService.handleWebhook(event, signature as string);

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: "Webhook triggered successfully",
      data: null,
    });
  },
);

// =====================================================
// GET SUBSCRIPTION STATUS
// =====================================================

const getSubscriptionStatus = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const result = await billingService.getSubscriptionStatus(userId as string);
    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Subscription status retrieved successfully",
      data: result,
    });
  },
);

// =====================================================
// EXPORT
// =====================================================

export const billingController = {
  createCheckoutSession,

  stripeWebhook,

  getSubscriptionStatus,
};
