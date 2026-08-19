import { Router } from "express";
import { organizationController } from "./organization.controller";
import { validateRequest } from "../../middleware/validateRequest";
import { organizationValidation } from "./organization.validation";
import { auth } from "../../middleware/auth";
import { UserRole } from "../../../generated/prisma/enums";

const router = Router();

router.post(
  "/",
  validateRequest(organizationValidation.createOrganizationValidationSchema),
  auth(UserRole.PLATFORM_USER),
  
  organizationController.createOrganizations,
);

export const organizationsRoutes = router;
