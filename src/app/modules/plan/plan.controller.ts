import  httpStatus  from 'http-status';
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { planServices } from "./plan.service";
import { sendResponse } from "../../utils/sendResponse";


// create plan
const createPlan = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await planServices.createPlan(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `${result.name} Plan Created SuccessFully!`,
    data: result,
  });
});


// export plan controller
export const planController = {
 createPlan
}