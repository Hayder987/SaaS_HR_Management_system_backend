
import { UserRole, UserStatus } from "../../generated/prisma/client";
import { prisma } from "../lib/prisma";

export const cleanupUnonboardedUsers = async () => {
  const now = new Date();

  const result = await prisma.user.updateMany({
    where: {
      status: UserStatus.ACTIVE,

      isEmailVerified: true,

      onboardingDeadline: {
        lte: now,
      },

      role: UserRole.PLATFORM_USER,

      memberships: {
        none: {},
      },

      ownedOrganizations: {
        none: {},
      },
    },

    data: {
      status: UserStatus.DELETED,
      deletedAt: now,
    },
  });

  console.log(
    `Soft deleted ${result.count} unonboarded users.`,
  );
};