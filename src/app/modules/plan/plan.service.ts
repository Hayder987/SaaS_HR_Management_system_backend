import Stripe from "stripe";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ICreatePlan } from "./plan.interface";

// create plan
const createPlan = async (payload: ICreatePlan) => {
  const { name, price, maxAdmins, maxHRs, maxEmployees } = payload;

  let stripeProduct: Stripe.Product | null = null;
  let stripePrice: Stripe.Price | null = null;

  try {
    const [activePlanCount, existingPlan] = await Promise.all([
      prisma.plan.count({
        where: {
          isActive: true,
        },
      }),

      prisma.plan.findUnique({
        where: {
          name,
        },
      }),
    ]);

    // Same name + active plan
    if (existingPlan?.isActive) {
      throw new Error(`Plan ${name} already exists and is active`);
    }

    if (!existingPlan && activePlanCount >= 4) {
      throw new Error(
        "Maximum 4 active plans allowed. You can update existing plans.",
      );
    }

    stripeProduct = await stripe.products.create({
      name: `HR Management - ${name}`,
      description: `${name} subscription plan for HR Management`,
      metadata: {
        planName: name,
      },
    });

    stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      currency: "usd",
      unit_amount: Math.round(Number(price) * 100),

      recurring: {
        interval: "year",
      },

      metadata: {
        planName: name,
      },
    });

    const plan = await prisma.$transaction(async (tx) => {
      // Re-check inside transaction
      // This protects against race conditions as much as possible.
      const activePlanCountInsideTransaction = await tx.plan.count({
        where: {
          isActive: true,
        },
      });

      const existingPlanInsideTransaction = await tx.plan.findUnique({
        where: {
          name,
        },
      });

      // Same active plan
      if (existingPlanInsideTransaction?.isActive) {
        throw new Error(`Plan ${name} already exists and is active`);
      }

      // Maximum 4 active plans
      if (
        !existingPlanInsideTransaction &&
        activePlanCountInsideTransaction >= 4
      ) {
        throw new Error(
          "Maximum 4 active plans allowed. You can update existing plans.",
        );
      }

      if (existingPlanInsideTransaction) {
        return await tx.plan.update({
          where: {
            id: existingPlanInsideTransaction.id,
          },

          data: {
            name,

            stripePriceId: stripePrice!.id,

            price,

            maxAdmins,
            maxHRs,
            maxEmployees,

            isActive: true,
          },
        });
      }

      return await tx.plan.create({
        data: {
          name,

          stripePriceId: stripePrice!.id,

          price,

          maxAdmins,
          maxHRs,
          maxEmployees,

          isActive: true,
        },
      });
    });

    return {
      ...plan,
      price: Number(plan.price),
    };
  } catch (error) {
    // Deactivate Stripe Price
    if (stripePrice?.id) {
      try {
        await stripe.prices.update(stripePrice.id, {
          active: false,
        });
      } catch (cleanupError) {
        console.error("Failed to deactivate Stripe price:", cleanupError);
      }
    }

    // Delete Stripe Product
    if (stripeProduct?.id) {
      try {
        await stripe.products.del(stripeProduct.id);
      } catch (cleanupError) {
        console.error("Failed to delete Stripe product:", cleanupError);
      }
    }

    throw error;
  }
};

// get All Plan Public
const getAllPlan = async () => {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },

    select: {
      id: true,
      name: true,
      price: true,
      maxAdmins: true,
      maxHRs: true,
      maxEmployees: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
    orderBy: {
      price: "asc",
    },
  });

  const formattedData = plans.map(({ _count, ...plan }) => ({
    ...plan,
    totalOrganization: _count.subscriptions,
    price: Number(plan.price),
  }));

  return formattedData;
};

// export plan services
export const planServices = {
  createPlan,
  getAllPlan,
};
