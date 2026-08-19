import Stripe from "stripe";
import { stripe } from "../../lib/stripe";
import { prisma } from "../../lib/prisma";
import {
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { sendSubscriptionSuccessEmail } from "../../services/email.service";

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

  const result = await prisma.$transaction(
    async (tx) => {
      const stripeSubscription =
        await stripe.subscriptions.retrieve(stripeSubscriptionId);

      const currentPeriodEnd = getPeriodEnd(stripeSubscription);
      const currentPeriodStart = getPeriodStart(stripeSubscription);

      const existingPayment = await tx.payment.findUnique({
        where: {
          stripeCheckoutSessionId: session.id,
        },
      });

      if (existingPayment) {
        console.log(`Checkout session already processed: ${session.id}`);

        return;
      }

      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },

        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        throw new Error("User not found while processing payment");
      }

      const plan = await tx.plan.findUnique({
        where: {
          id: planId,
        },

        select: {
          id: true,
          name: true,
          price: true,
        },
      });

      if (!plan) {
        throw new Error("Plan not found while processing payment");
      }

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
      const payment = await tx.payment.create({
        data: {
          userId,
          subscriptionId: subscription.id,
          stripeCheckoutSessionId: session.id,
          amount: (session?.amount_total!/100)?.toString()!,
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
          isOwner: true,
        },
      });

      return {
        user,

        plan,

        subscription,

        payment,
      };
    },
    {
      maxWait: 20000,
      timeout: 25000,
    },
  );

  const voucherNumber = `HR-VOUCHER-${result?.payment.id
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase()}`;

  // ====================================================
  // Generate Voucher + Send Email
  // ====================================================

  try {
    await sendSubscriptionSuccessEmail({
      voucherNumber,
      customerName: result?.user.name!,
      customerEmail: result?.user.email!,
      planName: result?.plan.name!,
      amount: result?.payment.amount.toString()!,
      currency: result?.payment.currency!,
      paymentDate: result?.payment.paidAt ?? new Date(),
      periodStart: result?.subscription?.currentPeriodStart!,
      periodEnd: result?.subscription.currentPeriodEnd!,
      stripeCustomerId,
      stripeSubscriptionId,
    });

    console.log(`Subscription success email sent to ${result?.user.email}`);
  } catch (error) {
    console.error("Failed to send subscription success email:", error);
  }
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
