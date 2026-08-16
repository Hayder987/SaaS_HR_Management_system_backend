import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userServices } from "./user.service";

const updateProfileImage = catchAsync(async (req: Request, res: Response) => {

  if (!req.file) {
    throw new Error("No File Provided.");
  }

  const userId = req.user?.id;

  const result = await userServices.updateProfileImage(req.file?.buffer, userId!)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Profile Image Upload && New tokens generated successfully",
    data: result,
  });
});

// export userControllers
export const userController = {
  updateProfileImage,
};
