import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authServices } from "./auth.service";

// register user
const registerUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authServices.registerUser(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

// forgot password
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authServices.forgotPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `Verification OTP send to Email: ${payload.email}`,
    data: result,
  });
});

// reset password
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authServices.resetPassword(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Password Reset successfully",
    data: result,
  });
});

export const authController = {
  registerUser,
  forgotPassword,
  resetPassword,
};
