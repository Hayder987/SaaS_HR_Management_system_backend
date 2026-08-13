import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ICreatePlan } from "./plan.interface";

// create plan
const createPlan = async (payload: ICreatePlan) => {
  const { name, price, maxAdmins, maxHRs, maxEmployees } = payload;

  const planCount = await prisma.plan.count();

  if (planCount > 4) {
    throw new Error("Maximum 4 Plan Card Created You Can Update Those Card");
  }

  const existingPlan = await prisma.plan.findUnique({
    where: {
      name,
    },
  });

  if (existingPlan) {
    throw new Error(`Plan ${name} already exists`);
  }

  let stripeProduct;
  let stripePrice;

  try {
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

    const plan = await prisma.plan.create({
      data: {
        name,
        stripePriceId: stripePrice.id,
        price,
        maxAdmins,
        maxHRs,
        maxEmployees,
      },
    });

    return {
        ...plan,
        price : Number(plan.price)
    };

  } catch (error) {
    if (stripePrice?.id) {
      try {
        await stripe.prices.update(stripePrice.id, {
          active: false,
        });
      } catch (cleanupError) {
        console.error("Failed to deactivate Stripe price:", cleanupError);
      }
    }

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
const getAllPlan = async()=>{

}



// export plan services
export const planServices = {
  createPlan,
  getAllPlan
};
