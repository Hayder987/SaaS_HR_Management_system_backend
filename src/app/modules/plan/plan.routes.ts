import { Router } from "express";
import { planController } from "./plan.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { planValidation } from "./plan.validation";

const router = Router();

// create plan by superAdmin
router.post(
  "/create",
  validateRequest(planValidation.createPlanZodSchema),
  planController.createPlan,
);

router.get("/", )

export const planRoutes = router;
