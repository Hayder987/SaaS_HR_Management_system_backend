import  httpStatus  from 'http-status';
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { organizationServices } from "./organization.service";
import { sendResponse } from "../../utils/sendResponse";

const createOrganizations = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const payload = req.body;

  const result = await organizationServices.createOrganization(
    userId as string,
    payload,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `You Have SuccessFully Created Your Organization! and Owner Membership`,
    data: result,
  });
});


// export organization controller

export const organizationController = {
 createOrganizations  
}