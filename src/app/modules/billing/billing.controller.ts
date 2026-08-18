import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { billingService } from "./billing.service";
import { sendResponse } from "../../utils/sendResponse";

const createCheckoutSession = catchAsync(
  async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const planId = req.body.planId;

    const result = await billingService.createCheckoutSession(
      userId as string,
      planId as string,
    );

    sendResponse(res, {
      success: true,
      statusCode: httpStatus.OK,
      message: "Access Token Generated Successfully!",
      data: result,
    });
  },
);

const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({
      success: false,

      message: "Stripe signature is missing",
    });
  }

  if (Array.isArray(signature)) {
    return res.status(400).json({
      success: false,

      message: "Invalid Stripe signature",
    });
  }

  const event = billingService.constructStripeEvent(
    req.body as Buffer,
    signature,
  );

  await billingService.handleStripeWebhook(event);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Access Token Generated Successfully!",
    data: null,
  });
});

// export
export const billingController = {
  createCheckoutSession,
  stripeWebhook
};
