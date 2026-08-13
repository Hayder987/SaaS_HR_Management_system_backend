import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authServices } from "./auth.service";

// register user
const registerUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

   await authServices.registerUser(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully & Email Verify OTP send To Your Mail",
    data: null,
  });
});

// forgot password
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

   await authServices.forgotPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Verification OTP send to Email: ${payload.email}`,
    data: null,
  });
});

// reset password
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

   await authServices.resetPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Password Reset successfully",
    data: null,
  });
});

// verify email
const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  await authServices.verifyEmail(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email Verified successfully And Send Success Mail",
    data: null,
  });
});

export const authController = {
  registerUser,
  forgotPassword,
  resetPassword,
  verifyEmail
};
