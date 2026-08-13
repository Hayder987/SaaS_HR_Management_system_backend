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

// get all plan
const getAllPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.getAllPlan();

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: `All Plan Retrieve SuccessFully!`,
    data: result,
  });
});

// get plan by id
const getPlanById = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await planServices.getPlanById(id as string);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Plan retrieved successfully",
      data: result,
    });
  },
);


// export plan controller
export const planController = {
 createPlan,
 getAllPlan,
 getPlanById
}