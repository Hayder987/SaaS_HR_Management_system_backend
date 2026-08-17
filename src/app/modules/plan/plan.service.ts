import Stripe from "stripe";

import { BillingInterval, PlanName } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";

import {
  ICreateFeature,
  ICreatePlan,
  IUpdateFeature,
  IUpdatePlan,
} from "./plan.interface";

const PLAN_NAMES: PlanName[] = [
  PlanName.BASIC,
  PlanName.BUSINESS,
  PlanName.ENTERPRISE,
];

const getTrialDays = (planName: PlanName): number => {
  return planName === PlanName.BASIC ? 7 : 0;
};

const getStripeInterval = (
  interval: BillingInterval,
): Stripe.PriceCreateParams.Recurring.Interval => {
  return interval === BillingInterval.YEARLY ? "year" : "month";
};

/*
|--------------------------------------------------------------------------
| FEATURE HELPERS
|--------------------------------------------------------------------------
*/

const validateFeatureIds = async (featureIds: string[]) => {
  if (!featureIds.length) {
    return;
  }

  const count = await prisma.feature.count({
    where: {
      id: {
        in: featureIds,
      },
      isActive: true,
    },
  });

  if (count !== featureIds.length) {
    throw new Error("One or more feature IDs are invalid or inactive");
  }
};

const syncPlanFeatures = async (
  tx: any,
  planId: string,
  featureIds: string[],
) => {
  await tx.planFeature.deleteMany({
    where: {
      planId,
    },
  });

  if (!featureIds.length) {
    return;
  }

  await tx.planFeature.createMany({
    data: featureIds.map((featureId) => ({
      planId,
      featureId,
      enabled: true,
    })),
    skipDuplicates: true,
  });
};

/*
|--------------------------------------------------------------------------
| STRIPE HELPERS
|--------------------------------------------------------------------------
*/

const createStripeProductAndPrice = async ({
  planName,
  displayName,
  description,
  price,
  billingInterval,
}: {
  planName: PlanName;
  displayName: string;
  description?: string;
  price: number;
  billingInterval: BillingInterval;
}) => {
  let product: Stripe.Product | null = null;
  let stripePrice: Stripe.Price | null = null;

  try {
    product = await stripe.products.create({
      name: `HR Management - ${displayName}`,
      description: description || `${displayName} subscription plan`,
      metadata: {
        planName,
        application: "hr-management",
      },
    });

    stripePrice = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: Math.round(price * 100),
      recurring: {
        interval: getStripeInterval(billingInterval),
      },
      metadata: {
        planName,
        billingInterval,
        application: "hr-management",
      },
    });

    return {
      product,
      price: stripePrice,
    };
  } catch (error) {
    if (stripePrice) {
      try {
        await stripe.prices.update(stripePrice.id, {
          active: false,
        });
      } catch (cleanupError) {
        console.error("Stripe price cleanup failed:", cleanupError);
      }
    }

    if (product) {
      try {
        await stripe.products.del(product.id);
      } catch (cleanupError) {
        console.error("Stripe product cleanup failed:", cleanupError);
      }
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| CREATE PLAN
|--------------------------------------------------------------------------
*/

const createPlan = async (payload: ICreatePlan) => {
  const {
    name,
    displayName,
    description,
    price,
    currency = "USD",
    billingInterval = BillingInterval.YEARLY,
    maxAdmins,
    maxHRs,
    maxManagers,
    maxEmployees,
    maxStorageMB,
    isPopular = false,
    sortOrder = 0,
    featureIds = [],
  } = payload;

  if (currency !== "USD") {
    throw new Error("Only USD currency is supported");
  }

  if (!PLAN_NAMES.includes(name)) {
    throw new Error("Invalid plan category");
  }

  const existingPlan = await prisma.plan.findUnique({
    where: {
      name,
    },
  });

  if (existingPlan) {
    throw new Error(`${name} plan already exists`);
  }

  await validateFeatureIds(featureIds);

  const trialDays = getTrialDays(name);

  let stripeProduct: Stripe.Product | null = null;
  let stripePrice: Stripe.Price | null = null;

  try {
    const stripeData = await createStripeProductAndPrice({
      planName: name,
      displayName,
      description,
      price,
      billingInterval,
    });

    stripeProduct = stripeData.product;
    stripePrice = stripeData.price;

    console.log("Stripe Product Created:", stripeProduct.id);
    console.log("Stripe Price Created:", stripePrice.id);

    const plan = await prisma.$transaction(async (tx) => {
      const existing = await tx.plan.findUnique({
        where: {
          name,
        },
      });

      if (existing) {
        throw new Error(`${name} plan already exists`);
      }

      const createdPlan = await tx.plan.create({
        data: {
          name,
          displayName,
          description,
          price,
          currency,
          billingInterval,
          maxAdmins,
          maxHRs,
          maxManagers,
          maxEmployees,
          maxStorageMB,
          trialDays,
          stripeProductId: stripeProduct!.id,
          stripePriceId: stripePrice!.id,
          isActive: true,
          isPopular,
          sortOrder,
        },
      });

      await syncPlanFeatures(tx, createdPlan.id, featureIds);

      return createdPlan;
    });

    return getPlanById(plan.id);
  } catch (error) {
    console.error("Plan creation failed. Cleaning Stripe resources...", error);

    if (stripePrice) {
      try {
        await stripe.prices.update(stripePrice.id, {
          active: false,
        });
      } catch (cleanupError) {
        console.error("Failed to deactivate Stripe price:", cleanupError);
      }
    }

    if (stripeProduct) {
      try {
        await stripe.products.del(stripeProduct.id);
      } catch (cleanupError) {
        console.error("Failed to delete Stripe product:", cleanupError);
      }
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL PLANS
|--------------------------------------------------------------------------
*/

const getAllPlan = async () => {
  const plans = await prisma.plan.findMany({
    where: {
      isActive: true,
    },
    include: {
      features: {
        where: {
          enabled: true,
          feature: {
            isActive: true,
          },
        },
        select: {
          feature: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        price: "asc",
      },
    ],
  });

  return plans.map(({ features, _count, ...plan }) => ({
    ...plan,
    price: Number(plan.price),
    totalOrganizations: _count.subscriptions,
    features: features.map((item) => item.feature),
  }));
};

/*
|--------------------------------------------------------------------------
| GET PLAN BY ID
|--------------------------------------------------------------------------
*/

const getPlanById = async (id: string) => {
  const plan = await prisma.plan.findFirst({
    where: {
      id,
      isActive: true,
    },
    include: {
      features: {
        where: {
          enabled: true,
          feature: {
            isActive: true,
          },
        },
        select: {
          feature: {
            select: {
              id: true,
              key: true,
              name: true,
              description: true,
            },
          },
        },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  return {
    ...plan,
    price: Number(plan.price),
    totalOrganizations: plan._count.subscriptions,
    features: plan.features.map((item) => item.feature),
  };
};

/*
|--------------------------------------------------------------------------
| UPDATE PLAN
|--------------------------------------------------------------------------
*/

const updatePlan = async (id: string, payload: IUpdatePlan) => {
  const currentPlan = await prisma.plan.findUnique({
    where: {
      id,
    },
  });

  if (!currentPlan) {
    throw new Error("Plan not found");
  }

  if (currentPlan.isActive !== true) {
    throw new Error("Plan must remain active");
  }

  if (payload.currency && payload.currency !== "USD") {
    throw new Error("Only USD currency is supported");
  }

  if (payload.featureIds !== undefined) {
    await validateFeatureIds(payload.featureIds);
  }

  const nextDisplayName = payload.displayName ?? currentPlan.displayName;

  const nextDescription =
    payload.description !== undefined
      ? payload.description
      : currentPlan.description;

  const nextPrice = payload.price ?? Number(currentPlan.price);

  const nextBillingInterval =
    payload.billingInterval ?? currentPlan.billingInterval;

  const priceChanged =
    payload.price !== undefined && payload.price !== Number(currentPlan.price);

  const intervalChanged =
    payload.billingInterval !== undefined &&
    payload.billingInterval !== currentPlan.billingInterval;

  const productChanged =
    nextDisplayName !== currentPlan.displayName ||
    nextDescription !== currentPlan.description;

  let newStripePrice: Stripe.Price | null = null;

  try {
    if (productChanged) {
      await stripe.products.update(currentPlan.stripeProductId!, {
        name: `HR Management - ${nextDisplayName}`,
        description: nextDescription || `${nextDisplayName} subscription plan`,
      });

      console.log("Stripe Product Updated:", currentPlan.stripeProductId);
    }

    if (priceChanged || intervalChanged) {
      newStripePrice = await stripe.prices.create({
        product: currentPlan.stripeProductId!,
        currency: "usd",
        unit_amount: Math.round(nextPrice * 100),
        recurring: {
          interval: getStripeInterval(nextBillingInterval),
        },
        metadata: {
          planName: currentPlan.name,
          billingInterval: nextBillingInterval,
          application: "hr-management",
        },
      });

      console.log("New Stripe Price Created:", newStripePrice.id);
    }

    const updatedPlan = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        displayName: nextDisplayName,
        description: nextDescription,
        price: nextPrice,
        currency: "USD",
        billingInterval: nextBillingInterval,
        isActive: true,
        trialDays: getTrialDays(currentPlan.name),
      };

      if (payload.maxAdmins !== undefined) {
        updateData.maxAdmins = payload.maxAdmins;
      }

      if (payload.maxHRs !== undefined) {
        updateData.maxHRs = payload.maxHRs;
      }

      if (payload.maxManagers !== undefined) {
        updateData.maxManagers = payload.maxManagers;
      }

      if (payload.maxEmployees !== undefined) {
        updateData.maxEmployees = payload.maxEmployees;
      }

      if (payload.maxStorageMB !== undefined) {
        updateData.maxStorageMB = payload.maxStorageMB;
      }

      if (payload.isPopular !== undefined) {
        updateData.isPopular = payload.isPopular;
      }

      if (payload.sortOrder !== undefined) {
        updateData.sortOrder = payload.sortOrder;
      }

      if (newStripePrice) {
        updateData.stripePriceId = newStripePrice.id;
      }

      const plan = await tx.plan.update({
        where: {
          id,
        },
        data: updateData,
      });

      if (payload.featureIds !== undefined) {
        await syncPlanFeatures(tx, id, payload.featureIds);
      }

      return plan;
    });

    if (newStripePrice && currentPlan.stripePriceId) {
      try {
        await stripe.prices.update(currentPlan.stripePriceId, {
          active: false,
        });

        console.log("Old Stripe Price Deactivated:", currentPlan.stripePriceId);
      } catch (error) {
        console.error("Old Stripe Price deactivation failed:", error);
      }
    }

    return getPlanById(updatedPlan.id);
  } catch (error) {
    console.error("Plan update failed:", error);

    if (newStripePrice) {
      try {
        await stripe.prices.update(newStripePrice.id, {
          active: false,
        });
      } catch (cleanupError) {
        console.error("New Stripe Price cleanup failed:", cleanupError);
      }
    }

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| FEATURE CRUD
|--------------------------------------------------------------------------
*/

const createFeature = async (payload: ICreateFeature) => {
  const key = payload.key.trim().toUpperCase();

  const existing = await prisma.feature.findUnique({
    where: {
      key,
    },
  });

  if (existing) {
    throw new Error(`Feature ${key} already exists`);
  }

  return prisma.feature.create({
    data: {
      key,
      name: payload.name.trim(),
      description: payload.description?.trim(),
      isActive: true,
    },
  });
};

const getAllFeatures = async () => {
  return prisma.feature.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      _count: {
        select: {
          plans: true,
        },
      },
    },
  });
};

const getFeatureById = async (id: string) => {
  const feature = await prisma.feature.findUnique({
    where: {
      id,
    },
    include: {
      plans: {
        where: {
          enabled: true,
          plan: {
            isActive: true,
          },
        },
        select: {
          plan: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!feature) {
    throw new Error("Feature not found");
  }

  return feature;
};

const updateFeature = async (id: string, payload: IUpdateFeature) => {
  const existing = await prisma.feature.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw new Error("Feature not found");
  }

  const nextKey = payload.key?.trim().toUpperCase();

  if (nextKey && nextKey !== existing.key) {
    const duplicate = await prisma.feature.findUnique({
      where: {
        key: nextKey,
      },
    });

    if (duplicate) {
      throw new Error(`Feature ${nextKey} already exists`);
    }
  }

  const data: any = {};

  if (nextKey !== undefined) {
    data.key = nextKey;
  }

  if (payload.name !== undefined) {
    data.name = payload.name.trim();
  }

  if (payload.description !== undefined) {
    data.description = payload.description;
  }

  if (payload.isActive !== undefined) {
    data.isActive = payload.isActive;
  }

  return prisma.feature.update({
    where: {
      id,
    },
    data,
  });
};

const deactivateFeature = async (id: string) => {
  const feature = await prisma.feature.findUnique({
    where: {
      id,
    },
  });

  if (!feature) {
    throw new Error("Feature not found");
  }

  return prisma.feature.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
};

export const planServices = {
  createPlan,
  getAllPlan,
  getPlanById,
  updatePlan,
  createFeature,
  getAllFeatures,
  getFeatureById,
  updateFeature,
  deactivateFeature,
};
