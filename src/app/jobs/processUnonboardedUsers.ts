import path from "path";
import ejs from "ejs";

import { UserRole, UserStatus } from "../../generated/prisma/client";

import { prisma } from "../lib/prisma";
import config from "../config";
import { transporter } from "../lib/nodemailer";

const testUserEmail = "hayderbd095@gmail.com";

export const processUnonboardedUsers = async () => {

  /**
   * ===================Testing Code Start =========================================
   */

  //   await prisma.user.update({
  //   where: {
  //     email: testUserEmail,
  //   },

  //   data: {
  //     status: UserStatus.ACTIVE,
  //     isEmailVerified: true,

  //     suspensionWarningAt: new Date(
  //       Date.now() - 60 * 60 * 1000,
  //     ),

  //     onboardingDeadline: new Date(
  //       Date.now() + 60 * 60 * 1000,
  //     ),

  //     suspensionWarningSentAt: null,
  //     suspensionEmailSentAt: null,
  //     suspendedAt: null,
  //   },
  // });

  // await prisma.user.update({
  //   where: {
  //     email: testUserEmail,
  //   },

  //   data: {
  //     status: UserStatus.ACTIVE,

  //     onboardingDeadline: new Date(
  //       Date.now() - 60 * 60 * 1000,
  //     ),

  //     suspensionEmailSentAt: null,
  //     suspendedAt: null,
  //   },
  // });

  /**
   * ===================Testing Code End =========================================
   */

  const now = new Date();
  const usersToWarn = await prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,

      isEmailVerified: true,

      suspensionWarningAt: {
        lte: now,
      },

      onboardingDeadline: {
        gt: now,
      },

      role: UserRole.PLATFORM_USER,

      memberships: {
        none: {},
      },

      ownedOrganizations: {
        none: {},
      },

      suspensionWarningSentAt: null,
    },

    select: {
      id: true,
      name: true,
      email: true,
      onboardingDeadline: true,
    },
  });

  const warningTemplatePath = path.join(
    process.cwd(),
    "src/app/templates/account-suspension-warning.ejs",
  );

  for (const user of usersToWarn) {
    try {
      const formattedSuspensionDate = user.onboardingDeadline?.toLocaleString(
        "en-US",
        {
          timeZone: "Asia/Dhaka",
          dateStyle: "long",
          timeStyle: "short",
        },
      );

      const html = await ejs.renderFile(warningTemplatePath, {
        name: user.name,
        suspensionDate: formattedSuspensionDate,
        actionUrl: `${config.frontend_url}/onboarding`,
        year: new Date().getFullYear(),
      });

      await transporter.sendMail({
        from: config.email_sender,
        to: user.email,
        subject: "Your Account Will Be Suspended Soon",
        html,
      });

      await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          suspensionWarningSentAt: now,
        },
      });

      console.log(`Suspension warning email sent to ${user.email}`);
    } catch (error) {
      console.error(
        `Failed to send suspension warning email to ${user.email}:`,
        error,
      );
    }
  }

  /**
   * ============================================================
   * 2. FIND USERS WHOSE 72-HOUR DEADLINE HAS PASSED
   * ============================================================
   */

  const usersToSuspend = await prisma.user.findMany({
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

    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  /**
   * ============================================================
   * 3. SUSPEND USER
   * ============================================================
   */

  const suspensionTemplatePath = path.join(
    process.cwd(),
    "src/app/templates/account-suspended.ejs",
  );

  for (const user of usersToSuspend) {
    try {
      const suspendedUser = await prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          status: UserStatus.SUSPENDED,
          suspendedAt: now,
        },

        select: {
          id: true,
          name: true,
          email: true,
          suspendedAt: true,
        },
      });

      console.log(`User ${suspendedUser.email} suspended.`);

      /**
       * ========================================================
       * 4. SEND SUSPENSION EMAIL
       * ========================================================
       */

      const formattedSuspendedAt = suspendedUser.suspendedAt?.toLocaleString(
        "en-US",
        {
          timeZone: "Asia/Dhaka",
          dateStyle: "long",
          timeStyle: "short",
        },
      );

      const html = await ejs.renderFile(suspensionTemplatePath, {
        name: suspendedUser.name,
        suspendedAt: formattedSuspendedAt,
        supportUrl: `${config.frontend_url}/support`,
        year: new Date().getFullYear(),
      });

      await transporter.sendMail({
        from: config.email_sender,
        to: suspendedUser.email,
        subject: "Your Account Has Been Suspended",
        html,
      });

      await prisma.user.update({
        where: {
          id: suspendedUser.id,
        },

        data: {
          suspensionEmailSentAt: now,
        },
      });

      console.log(`Suspension email sent to ${suspendedUser.email}`);
    } catch (error) {
      console.error(`Failed to suspend/process user ${user.email}:`, error);
    }
  }

  console.log(
    `Processed ${usersToWarn.length} warning emails and ${usersToSuspend.length} suspensions.`,
  );
};
