import Stripe from "stripe";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { ICheckoutResponse } from "./billing.interface";
import { SubscriptionStatus } from "../../../generated/prisma/enums";
import { handleChangeSubscription, handleCheckoutCompleted } from "./billing.utils";

// =====================================================
// CREATE CHECKOUT SESSION
// =====================================================

const createCheckoutSession = async (
  userId: string,
  planId: string,
): Promise<ICheckoutResponse> => {
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },
        include :{
          subscriptions : {
            select : {
             stripeSubscriptionId : true,
             stripeCustomerId : true,
             status : true
            }
          }
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      const plan = await tx.plan.findUnique({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new Error("Plan not found");
      }

      if (!plan.isActive) {
        throw new Error("Selected plan is not active");
      }

      if (!plan.stripePriceId) {
        throw new Error("Stripe price is not configured for this plan");
      }

      let stripeCustomerId = user.subscriptions?.stripeCustomerId;

      if (!stripeCustomerId) {
        // create new customer
        const customer = await stripe.customers.create({
          email: user?.email,
          name: user?.name,
          metadata: {
            userId: user?.id,
          },
        });

        stripeCustomerId = customer.id;
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        client_reference_id: user.id,
        success_url: `${config.frontend_url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontend_url}/billing/cancel`,
        metadata: {
          userId: user.id,
          planId: plan.id,
        },
      });

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
      };
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );

  return transactionResult;
};

// handle webhook get subscription info
const handleWebhook = async (payload: Buffer, signature: string) => {
  const endpointSecret = config.stripe_webhook_secret;

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    endpointSecret,
  );
   
  switch (event.type) {
    case "checkout.session.completed":
      const session: Stripe.Checkout.Session = event.data.object;
      await handleCheckoutCompleted(session);
      break;

    case "customer.subscription.updated":
      await handleChangeSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleChangeSubscription(event.data.object);
      break;

    default:
      // Unexpected event type
      console.log(`No events matched. Unhandled event type ${event.type}.`);
      break;
  }

};

// get subscription status'
const getSubscriptionStatus = async (userId: string) => {
  const isSubscriptionExist = await prisma.subscription.findUniqueOrThrow({
    where: {
      userId,
    },
  });

  const isActive =
    isSubscriptionExist.status === "ACTIVE" &&
    isSubscriptionExist.currentPeriodEnd &&
    new Date(isSubscriptionExist.currentPeriodEnd) > new Date();

  return {
    status: isSubscriptionExist.status,
    isActive,
    currentPeriodEnd: isSubscriptionExist.currentPeriodEnd,
  };
};



export const billingService = {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus
};
