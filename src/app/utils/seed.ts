import bcrypt from "bcryptjs";
import { UserRole } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
  try {
    const name = config.super_admin_name;
    const email = config.super_admin_email;
    const password = config.super_admin_password;

    // Validate environment variables first
    if (!name || !email || !password) {
      throw new Error(
        "Super Admin Name, Email, Password Missing In Env File!!!",
      );
    }

    const superAdmin = await prisma.$transaction(
      async (tx) => {
        const isSuperAdminExist = await tx.user.findFirst({
          where: {
            role: UserRole.SUPER_ADMIN,
          },
        });

        if (isSuperAdminExist) {
          console.log("Super Admin Already Exists!");
          return null;
        }

        const hashedPassword = await bcrypt.hash(
          password,
          Number(config.bcrypt_salt_rounds),
        );

        return await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: UserRole.SUPER_ADMIN,
            isEmailVerified: true,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );

    if (!superAdmin) {
      return;
    }

    console.log("Super Admin Created Successfully:", {
      id: superAdmin.id,
      email: superAdmin.email,
    });
  } catch (error) {
    console.error("Error Seeding Super Admin:", error);
    throw error;
  }
};
