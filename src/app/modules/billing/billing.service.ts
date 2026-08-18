import Stripe from "stripe";
import config from "../../config";
import { ICheckoutResponse } from "./billing.interface";
import { prisma } from "../../lib/prisma";
import { PaymentMethod, PaymentStatus, PaymentType, SubscriptionStatus } from "../../../generated/prisma/enums";
import { stripe } from "../../lib/stripe";



// =====================================================
// CREATE CHECKOUT SESSION
// =====================================================

const createCheckoutSession = async (
  userId: string,
  planId: string,
): Promise<ICheckoutResponse> => {
  

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("User account is not active");
  }

  if (!user.isEmailVerified) {
    throw new Error("Please verify your email first");
  }

  // ---------------------------------------------------
  // If already premium, don't create another subscription
  // ---------------------------------------------------

  const existingActiveSubscription =
    await prisma.subscription.findFirst({
      where: {
        userId,

        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.INCOMPLETE,
          ],
        },
      },
    });

  if (existingActiveSubscription) {
    throw new Error(
      "You already have an existing subscription",
    );
  }

  // ---------------------------------------------------
  // Find plan
  // ---------------------------------------------------

  const plan = await prisma.plan.findUnique({
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
    throw new Error(
      "Stripe price is not configured for this plan",
    );
  }

  // ---------------------------------------------------
  // Stripe customer
  // ---------------------------------------------------

  let stripeCustomerId: string | undefined;

  // Reuse previous Stripe customer if exists
  const previousSubscription =
    await prisma.subscription.findFirst({
      where: {
        userId,

        stripeCustomerId: {
          not: null,
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      select: {
        stripeCustomerId: true,
      },
    });

  if (previousSubscription?.stripeCustomerId) {
    stripeCustomerId =
      previousSubscription.stripeCustomerId;
  } else {
    const customer =
      await stripe.customers.create({
        name: user.name,
        email: user.email,

        metadata: {
          userId: user.id,
        },
      });

    stripeCustomerId = customer.id;
  }

  // ---------------------------------------------------
  // Create local subscription first
  // ---------------------------------------------------

  const localSubscription =
    await prisma.subscription.create({
      data: {
        userId,

        planId,

        stripeCustomerId,

        status: SubscriptionStatus.INCOMPLETE,
      },
    });

  try {
    // -------------------------------------------------
    // Stripe Checkout
    // -------------------------------------------------

    const checkoutSession =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        customer: stripeCustomerId,

        line_items: [
          {
            price: plan.stripePriceId,

            quantity: 1,
          },
        ],

        client_reference_id: user.id,

        success_url:
          `${config.frontend_url}/billing/success` +
          `?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${config.frontend_url}/billing/cancel`,

        metadata: {
          userId: user.id,

          planId: plan.id,

          subscriptionId:
            localSubscription.id,
        },

        subscription_data: {
          metadata: {
            userId: user.id,

            planId: plan.id,

            subscriptionId:
              localSubscription.id,
          },
        },
      });

    // -------------------------------------------------
    // Create pending payment
    // -------------------------------------------------

    await prisma.payment.create({
      data: {
        userId: user.id,

        subscriptionId:
          localSubscription.id,

        amount: plan.price,

        currency: plan.currency,

        paymentMethod:
          PaymentMethod.STRIPE,

        type: PaymentType.SUBSCRIPTION,

        status: PaymentStatus.PENDING,

        metadata: {
          checkoutSessionId:
            checkoutSession.id,

          planId: plan.id,

          planName: plan.name,
        },
      },
    });

    return {
      sessionId: checkoutSession.id,

      url: checkoutSession.url,
    };
  } catch (error) {
    // -----------------------------------------------
    // Rollback local subscription
    // -----------------------------------------------

    await prisma.subscription.delete({
      where: {
        id: localSubscription.id,
      },
    });

    throw error;
  }
};

// =====================================================
// STRIPE SUBSCRIPTION STATUS MAPPER
// =====================================================

const mapStripeSubscriptionStatus = (
  status: Stripe.Subscription.Status,
): SubscriptionStatus => {
  switch (status) {
    case "trialing":
      return SubscriptionStatus.TRIALING;

    case "active":
      return SubscriptionStatus.ACTIVE;

    case "past_due":
      return SubscriptionStatus.PAST_DUE;

    case "canceled":
      return SubscriptionStatus.CANCELED;

    case "incomplete":
      return SubscriptionStatus.INCOMPLETE;

    case "incomplete_expired":
      return SubscriptionStatus.EXPIRED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
};

// =====================================================
// STRIPE DATE HELPER
// =====================================================

const convertStripeDate = (
  timestamp?: number | null,
): Date | null => {
  if (timestamp == null) {
    return null;
  }

  return new Date(timestamp * 1000);
};

// =====================================================
// STRIPE SUBSCRIPTION PERIOD HELPER
// =====================================================

const getSubscriptionPeriod = (
  subscription: Stripe.Subscription,
) => {
  const subscriptionItem =
    subscription.items.data[0];

  if (!subscriptionItem) {
    return {
      currentPeriodStart: null,
      currentPeriodEnd: null,
    };
  }

  return {
    currentPeriodStart:
      convertStripeDate(
        subscriptionItem.current_period_start,
      ),

    currentPeriodEnd:
      convertStripeDate(
        subscriptionItem.current_period_end,
      ),
  };
};

// =====================================================
// INVOICE SUBSCRIPTION ID HELPER
// =====================================================

const getInvoiceSubscriptionId = (
  invoice: Stripe.Invoice,
): string | null => {
  const subscription =
    invoice.parent
      ?.subscription_details
      ?.subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string"
    ? subscription
    : subscription.id;
};

// =====================================================
// INVOICE PAYMENT INTENT ID HELPER
// =====================================================

const getInvoicePaymentIntentId = async (
  invoiceId: string,
): Promise<string | null> => {
  const invoice =
    await stripe.invoices.retrieve(
      invoiceId,
      {
        expand: [
          "payments.data.payment.payment_intent",
        ],
      },
    );

  const payments =
    invoice.payments?.data ?? [];

  for (const invoicePayment of payments) {
    const payment =
      invoicePayment.payment;

    if (!payment) {
      continue;
    }

    if (payment.type !== "payment_intent") {
      continue;
    }

    const paymentIntent =
      payment.payment_intent;

    if (!paymentIntent) {
      continue;
    }

    return typeof paymentIntent ===
      "string"
      ? paymentIntent
      : paymentIntent.id;
  }

  return null;
};

// =====================================================
// CHECKOUT COMPLETED
// =====================================================

const handleCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  const userId =
    session.metadata?.userId ||
    session.client_reference_id;

  const planId =
    session.metadata?.planId;

  const localSubscriptionId =
    session.metadata?.subscriptionId;

  if (
    !userId ||
    !planId ||
    !localSubscriptionId
  ) {
    throw new Error(
      "Stripe checkout metadata is missing",
    );
  }

  // ---------------------------------------------------
  // Stripe subscription ID
  // ---------------------------------------------------

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!stripeSubscriptionId) {
    throw new Error(
      "Stripe subscription ID not found",
    );
  }

  // ---------------------------------------------------
  // Stripe customer ID
  // ---------------------------------------------------

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  // ---------------------------------------------------
  // Retrieve actual subscription from Stripe
  // ---------------------------------------------------

  const stripeSubscription =
    await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
    );

  const status =
    mapStripeSubscriptionStatus(
      stripeSubscription.status,
    );

  const {
    currentPeriodStart,
    currentPeriodEnd,
  } =
    getSubscriptionPeriod(
      stripeSubscription,
    );

  // ---------------------------------------------------
  // Transaction
  // ---------------------------------------------------

  await prisma.$transaction(async (tx) => {
    const localSubscription =
      await tx.subscription.findUnique({
        where: {
          id: localSubscriptionId,
        },
      });

    if (!localSubscription) {
      throw new Error(
        "Local subscription not found",
      );
    }

    // -----------------------------------------------
    // Update subscription
    // -----------------------------------------------

    await tx.subscription.update({
      where: {
        id: localSubscription.id,
      },

      data: {
        stripeCustomerId:
          stripeCustomerId ||
          localSubscription.stripeCustomerId,

        stripeSubscriptionId,

        status,

        currentPeriodStart,

        currentPeriodEnd,

        cancelAtPeriodEnd:
          stripeSubscription.cancel_at_period_end,

        canceledAt:
          convertStripeDate(
            stripeSubscription.canceled_at,
          ),
      },
    });

    // -----------------------------------------------
    // Payment
    // -----------------------------------------------

    if (
      session.payment_status === "paid"
    ) {
      await tx.payment.updateMany({
        where: {
          subscriptionId:
            localSubscription.id,

          status:
            PaymentStatus.PENDING,
        },

        data: {
          status:
            PaymentStatus.PAID,

          paidAt: new Date(),

          metadata: {
            checkoutSessionId:
              session.id,

            stripeSubscriptionId,

            stripeCustomerId:
              stripeCustomerId || null,
          },
        },
      });
    }

    // -----------------------------------------------
    // PREMIUM USER
    // -----------------------------------------------

    if (
      status === SubscriptionStatus.ACTIVE ||
      status ===
        SubscriptionStatus.TRIALING
    ) {
      await tx.user.update({
        where: {
          id: userId,
        },

        data: {
          isPremium: true,
        },
      });
    }
  });
};

// =====================================================
// INVOICE PAID
// =====================================================

const handleInvoicePaid = async (
  invoice: Stripe.Invoice,
) => {
  const stripeSubscriptionId =
    getInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return;
  }

  // ---------------------------------------------------
  // Find local subscription
  // ---------------------------------------------------

  const localSubscription =
    await prisma.subscription.findUnique({
      where: {
        stripeSubscriptionId,
      },
    });

  if (!localSubscription) {
    console.log(
      "Local subscription not found:",
      stripeSubscriptionId,
    );

    return;
  }

  // ---------------------------------------------------
  // Get Stripe subscription
  // ---------------------------------------------------

  const stripeSubscription =
    await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
    );

  const status =
    mapStripeSubscriptionStatus(
      stripeSubscription.status,
    );

  const {
    currentPeriodStart,
    currentPeriodEnd,
  } =
    getSubscriptionPeriod(
      stripeSubscription,
    );

  // ---------------------------------------------------
  // Payment Intent
  // ---------------------------------------------------

  const paymentIntentId =
    await getInvoicePaymentIntentId(
      invoice.id,
    );

  await prisma.$transaction(async (tx) => {
    // -----------------------------------------------
    // Update subscription
    // -----------------------------------------------

    await tx.subscription.update({
      where: {
        id: localSubscription.id,
      },

      data: {
        status,

        currentPeriodStart,

        currentPeriodEnd,
      },
    });

    // -----------------------------------------------
    // Premium access
    // -----------------------------------------------

    await tx.user.update({
      where: {
        id: localSubscription.userId,
      },

      data: {
        isPremium:
          status ===
            SubscriptionStatus.ACTIVE ||
          status ===
            SubscriptionStatus.TRIALING,
      },
    });

    // -----------------------------------------------
    // Don't duplicate payment if payment intent exists
    // -----------------------------------------------

    if (paymentIntentId) {
      const existingPayment =
        await tx.payment.findUnique({
          where: {
            stripePaymentIntentId:
              paymentIntentId,
          },
        });

      if (!existingPayment) {
        await tx.payment.create({
          data: {
            userId:
              localSubscription.userId,

            subscriptionId:
              localSubscription.id,

            amount:
              invoice.amount_paid
                ? invoice.amount_paid /
                  100
                : 0,

            currency:
              invoice.currency?.toUpperCase() ||
              "USD",

            paymentMethod:
              PaymentMethod.STRIPE,

            type:
              PaymentType.SUBSCRIPTION,

            status:
              PaymentStatus.PAID,

            paidAt: new Date(),

            stripePaymentIntentId:
              paymentIntentId,

            metadata: {
              invoiceId:
                invoice.id,

              stripeSubscriptionId,
            },
          },
        });
      }
    }
  });
};

// =====================================================
// INVOICE PAYMENT FAILED
// =====================================================

const handleInvoicePaymentFailed = async (
  invoice: Stripe.Invoice,
) => {
  const stripeSubscriptionId =
    getInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    return;
  }

  const localSubscription =
    await prisma.subscription.findUnique({
      where: {
        stripeSubscriptionId,
      },
    });

  if (!localSubscription) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: {
        id: localSubscription.id,
      },

      data: {
        status:
          SubscriptionStatus.PAST_DUE,
      },
    });

    await tx.user.update({
      where: {
        id: localSubscription.userId,
      },

      data: {
        isPremium: false,
      },
    });
  });
};

// =====================================================
// SUBSCRIPTION UPDATED
// =====================================================

const handleSubscriptionUpdated = async (
  stripeSubscription: Stripe.Subscription,
) => {
  const localSubscription =
    await prisma.subscription.findUnique({
      where: {
        stripeSubscriptionId:
          stripeSubscription.id,
      },
    });

  if (!localSubscription) {
    return;
  }

  const status =
    mapStripeSubscriptionStatus(
      stripeSubscription.status,
    );

  const hasPremiumAccess =
    status === SubscriptionStatus.ACTIVE ||
    status === SubscriptionStatus.TRIALING;

  const {
    currentPeriodStart,
    currentPeriodEnd,
  } =
    getSubscriptionPeriod(
      stripeSubscription,
    );

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: {
        id: localSubscription.id,
      },

      data: {
        status,

        currentPeriodStart,

        currentPeriodEnd,

        cancelAtPeriodEnd:
          stripeSubscription.cancel_at_period_end,

        canceledAt:
          convertStripeDate(
            stripeSubscription.canceled_at,
          ),
      },
    });

    await tx.user.update({
      where: {
        id: localSubscription.userId,
      },

      data: {
        isPremium: hasPremiumAccess,
      },
    });
  });
};

// =====================================================
// SUBSCRIPTION DELETED
// =====================================================

const handleSubscriptionDeleted = async (
  stripeSubscription: Stripe.Subscription,
) => {
  const localSubscription =
    await prisma.subscription.findUnique({
      where: {
        stripeSubscriptionId:
          stripeSubscription.id,
      },
    });

  if (!localSubscription) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: {
        id: localSubscription.id,
      },

      data: {
        status:
          SubscriptionStatus.CANCELED,

        canceledAt: new Date(),
      },
    });

    await tx.user.update({
      where: {
        id: localSubscription.userId,
      },

      data: {
        isPremium: false,
      },
    });
  });
};

// =====================================================
// HANDLE WEBHOOK EVENT
// =====================================================

const handleStripeWebhook = async (
  event: Stripe.Event,
) => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session =
        event.data.object as Stripe.Checkout.Session;

      await handleCheckoutCompleted(
        session,
      );

      break;
    }

    case "invoice.paid": {
      const invoice =
        event.data.object as Stripe.Invoice;

      await handleInvoicePaid(invoice);

      break;
    }

    case "invoice.payment_failed": {
      const invoice =
        event.data.object as Stripe.Invoice;

      await handleInvoicePaymentFailed(
        invoice,
      );

      break;
    }

    case "customer.subscription.updated": {
      const subscription =
        event.data.object as Stripe.Subscription;

      await handleSubscriptionUpdated(
        subscription,
      );

      break;
    }

    case "customer.subscription.deleted": {
      const subscription =
        event.data.object as Stripe.Subscription;

      await handleSubscriptionDeleted(
        subscription,
      );

      break;
    }

    default:
      console.log(
        `Unhandled Stripe event: ${event.type}`,
      );
  }
};

// =====================================================
// VERIFY STRIPE WEBHOOK
// =====================================================

const constructStripeEvent = (
  payload: Buffer,
  signature: string,
): Stripe.Event => {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe_webhook_secret,
  );
};

// =====================================================
// EXPORT
// =====================================================

export const billingService = {
  createCheckoutSession,

  handleStripeWebhook,

  constructStripeEvent,
};