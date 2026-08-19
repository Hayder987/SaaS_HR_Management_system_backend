import Stripe from "stripe";
import { stripe } from "../../lib/stripe";
import { prisma } from "../../lib/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";

// convert endtime millisec to date string
export const getPeriodEnd = (payload: Stripe.Subscription) => {
  const getCurrentPeriodEndInmillisec =
    payload.items.data[0]?.current_period_end!;

  const getCurrentPeriodEnd = new Date(getCurrentPeriodEndInmillisec * 1000);
  return getCurrentPeriodEnd;
};

export const getPeriodStart = (payload: Stripe.Subscription) => {
  const getCurrentPeriodStartInmillisec =
    payload.items.data[0]?.current_period_start!;

  const getCurrentPeriodEnd = new Date(getCurrentPeriodStartInmillisec * 1000);
  return getCurrentPeriodEnd;
};

// Occurs when a Checkout Session has been successfully completed. handler
export const handleCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  if (!session) {
    console.log("No Session Found");
    return;
  }

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId || !planId || !stripeSubscriptionId || !stripeCustomerId) {
    console.log("Webhook : Missing values For Creating Checkout Session");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const stripeSubscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      const currentPeriodEnd = getPeriodEnd(stripeSubscription);
      const currentPeriodStart = getPeriodStart(stripeSubscription);

      // create or update subscriptions
      const subscription = await tx.subscription.upsert({
        where: {
          userId,
        },
        create: {
          userId,
          planId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: SubscriptionStatus.CREATED,
          currentPeriodStart,
          currentPeriodEnd,
        },
        update: {
          planId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart,
          currentPeriodEnd,
        },
      });

      // create payment
      await tx.payment.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          amount: session.amount_total?.toString()!,
          currency: "USD",
          paymentMethod: PaymentMethod.STRIPE,
          status: PaymentStatus.PAID,
          paidAt: currentPeriodStart,
          metadata: {
            planId,
            stripeCustomerId,
            country: session.customer_details?.address?.country,
            invoice: session?.invoice as string,
            payment_status: session?.payment_status,
            presentment_amount:
              session?.presentment_details?.presentment_amount,
            presentment_currency:
              session?.presentment_details?.presentment_currency,
          },
        },
      });

      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          isPremium: true,
        },
      });
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
};

// handle subcription update status
export const handleChangeSubscription = async (
  payload: Stripe.Subscription,
) => {
  const stripeSubscriptionId = payload.id;

  const status =
    payload.status === "active" || payload.status === "trialing"
      ? SubscriptionStatus.ACTIVE
      : payload.status === "canceled"
        ? SubscriptionStatus.CANCELED
        : SubscriptionStatus.EXPIRED;

  const currentPeriodEnd = getPeriodEnd(payload);

  await prisma.$transaction(
    async (tx) => {
      const isSubscriptionExist = await tx.subscription.findUnique({
        where: {
          stripeSubscriptionId,
        },
      });

      if (!isSubscriptionExist) {
        console.log(
          `Webhook : No Subscription found for subscription id : ${stripeSubscriptionId}`,
        );

        return;
      }

      await tx.subscription.update({
        where: {
          stripeSubscriptionId,
        },
        data: {
          status,
          currentPeriodEnd,
        },
      });
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
};
