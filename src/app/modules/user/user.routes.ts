import { Router } from "express";
import { userController } from "./user.controller";
import { upload } from "../../lib/multer";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/auth";

const router = Router();

router.patch(
  "/profile-image",
  auth(UserRole.PLATFORM_USER, UserRole.SUPER_ADMIN),
  upload.single("profileImage"),
  userController.updateProfileImage,
);

export const userRoutes = router;
