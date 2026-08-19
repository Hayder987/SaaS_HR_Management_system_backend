import {
  MembershipStatus,
  OrganizationStatus,
  OrgRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { ICreateOrganizationPayload } from "./organization.interface";

// create organization
const createOrganization = async (
  userId: string,
  payload: ICreateOrganizationPayload,
) => {
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          subscriptions: {
            select: {
              organizationId: true,
              currentPeriodEnd: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error("User Not Found! Please Login");
      }

      if (!user.isPremium && !user.isOwner && !user?.subscriptions) {
        throw new Error("User Not Premium! Buy Subscription and try again");
      }

      // Check whether user already owns an organization
      const existingOwnedOrganization = await tx.organization.findFirst({
        where: {
          ownerUserId: userId,
          status: {
            not: OrganizationStatus.DELETED,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingOwnedOrganization) {
        throw new Error("You already own an organization");
      }

      // check Organization slug exists
      const existingOrganization = await tx.organization.findUnique({
        where: {
          slug: payload.slug,
        },
        select: {
          id: true,
        },
      });

      if (existingOrganization) {
        throw new Error("Organization slug already exists give New");
      }

      const organization = await tx.organization.create({
        data: {
          name: payload.name,
          slug: payload.slug,
          email: payload.email,

          phone: payload.phone,
          address: payload.address,

          locationName: payload.locationName,
          latitude: payload.latitude,
          longitude: payload.longitude,

          attendanceRadiusMeters: payload.attendanceRadiusMeters ?? 100,
          timezone: payload.timezone ?? "Asia/Dhaka",
          currency: payload.currency ?? "USD",
          status: OrganizationStatus.ACTIVE,
          onboardingDeadline: user?.subscriptions?.currentPeriodEnd,
          ownerUserId: userId,
        },
      });

      const membership = await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,

          orgRole: OrgRole.OWNER,
          status: MembershipStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where : {
            id : userId,

        },
        data : {
            onboardingDeadline : null,
            suspensionWarningAt : null,
        }
      })

      return {
        organization,
        membership,
      };
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );

  return transactionResult;
};


// export organization services
export const organizationServices = {
  createOrganization,
};
