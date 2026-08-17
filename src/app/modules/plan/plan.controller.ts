import httpStatus from "http-status";
import { Request, Response } from "express";

import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

import { planServices } from "./plan.service";

/*
|--------------------------------------------------------------------------
| PLAN
|--------------------------------------------------------------------------
*/

const createPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.createPlan(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Plan created successfully",
    data: result,
  });
});

const getAllPlan = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.getAllPlan();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All plans retrieved successfully",
    data: result,
  });
});

const getPlanById = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.getPlanById(req.params.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan retrieved successfully",
    data: result,
  });
});

const updatePlan = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.updatePlan(
    req.params.id as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Plan updated successfully",
    data: result,
  });
});

/*
|--------------------------------------------------------------------------
| FEATURE
|--------------------------------------------------------------------------
*/

const createFeature = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.createFeature(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feature created successfully",
    data: result,
  });
});

const getAllFeatures = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.getAllFeatures();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Features retrieved successfully",
    data: result,
  });
});

const getFeatureById = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.getFeatureById(
    req.params.featureId as string,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature retrieved successfully",
    data: result,
  });
});

const updateFeature = catchAsync(async (req: Request, res: Response) => {
  const result = await planServices.updateFeature(
    req.params.featureId as string,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature updated successfully",
    data: result,
  });
});

const deactivateFeature = catchAsync(
  async (req: Request, res: Response) => {
    const result = await planServices.deactivateFeature(
      req.params.featureId as string,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Feature deactivated successfully",
      data: result,
    });
  },
);

export const planController = {
  createPlan,
  getAllPlan,
  getPlanById,
  updatePlan,
  createFeature,
  getAllFeatures,
  getFeatureById,
  updateFeature,
  deactivateFeature,
};