import { Router } from "express";

import { planController } from "./plan.controller";
import { planValidation } from "./plan.validation";

import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/auth";

import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

/*
|--------------------------------------------------------------------------
| FEATURE ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/features/all",
  auth(UserRole.SUPER_ADMIN),
  planController.getAllFeatures,
);

router.get(
  "/features/:featureId",
  auth(UserRole.SUPER_ADMIN, UserRole.PLATFORM_USER),
  planController.getFeatureById,
);

router.post(
  "/features/create",
  auth(UserRole.SUPER_ADMIN),
  validateRequest(planValidation.createFeatureZodSchema),
  planController.createFeature,
);

router.patch(
  "/features/:featureId",
  auth(UserRole.SUPER_ADMIN),
  validateRequest(planValidation.updateFeatureZodSchema),
  planController.updateFeature,
);

router.patch(
  "/features/:featureId/deactivate",
  auth(UserRole.SUPER_ADMIN),
  planController.deactivateFeature,
);

/*
|--------------------------------------------------------------------------
| PLAN ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  planController.getAllPlan,
);

router.get(
  "/:id",
  planController.getPlanById,
);

router.post(
  "/create",
  auth(UserRole.SUPER_ADMIN),
  validateRequest(planValidation.createPlanZodSchema),
  planController.createPlan,
);

router.patch(
  "/:id",
  auth(UserRole.SUPER_ADMIN),
  validateRequest(planValidation.updatePlanZodSchema),
  planController.updatePlan,
);

export const planRoutes = router;
