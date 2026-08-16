import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authServices } from "./auth.service";
import config from "../../config";

// register user
const registerUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  await authServices.registerUser(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message:
      `You are Temporary registered & Email Verification OTP send To Your Email:${payload.email}`,
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
    message: "Email Verified And Permanent Registered successfully And Send Success Mail",
    data: null,
  });
});

// google login
const googleLogin = catchAsync(async (req: Request, res: Response) => {
  if (req.headers["x-requested-with"] !== "XMLHttpRequest") {
    throw new Error("Invalid Google Login Request");
  }

  const payload = req.body;

  const { accessToken, refreshToken, user } =
    await authServices.googleLogin(payload);

  const isProduction = config.node_env === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
  });

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: "Google login successful",
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

// login User
const loginUser = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await authServices.loginUser(payload);

  const { accessToken, refreshToken, user, access, memberships } = result;

  const isProduction = config.node_env === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 3, // 3 days
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 15, // 15 days
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      user,
      access,
      memberships,
    },
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

// resend otp email verify or forgot pass otp
const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  await authServices.resendOtp(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `New Verification OTP Code send to Email: ${payload.email}`,
    data: null,
  });
});

export const authController = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendOtp,
  googleLogin
};
