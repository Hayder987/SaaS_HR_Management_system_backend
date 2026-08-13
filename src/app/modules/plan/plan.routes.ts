import { Router } from "express";
import { planController } from "./plan.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { planValidation } from "./plan.validation";

const router = Router();

// get all plan
router.get("/", planController.getAllPlan)

router.get(
  "/:id",
  planController.getPlanById,
);

// create plan by superAdmin
router.post(
  "/create",
  validateRequest(planValidation.createPlanZodSchema),
  planController.createPlan,
);

export const planRoutes = router;
