import Stripe from "stripe";
import {
  ICreateCheckoutResponse,
  ICreateOrganizationCheckOut,
  ISubscriptionStatusResponse,
} from "./billing.interface";
import { prisma } from "../../lib/prisma";
import {
  MembershipStatus,
  OrganizationStatus,
  OrgRole,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { stripe } from "../../lib/stripe";
import config from "../../config";
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
  handleTrialWillEnd,
} from "./billing.utils";

// =====================================================
// CREATE ORGANIZATION + STRIPE CHECKOUT
// =====================================================

const createCheckoutSession = async (
  userId: string,
  payload: ICreateOrganizationCheckOut,
): Promise<ICreateCheckoutResponse> => {
  const { name, planId, phone, timezone } = payload;

  if (!payload) {
    throw new Error("FormData Not Found");
  }

  if (!name) {
    throw new Error("Organization Name Not Found");
  }

  if (!planId) {
    throw new Error("PlanId Not Found: Please Select Plan");
  }

  if (!phone) {
    throw new Error("Phone Not Found: Please Give Your Phone Number");
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // -----------------------------------------------
      // USER
      // -----------------------------------------------

      const user = await tx.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // -----------------------------------------------
      // PLAN
      // -----------------------------------------------

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
        throw new Error("Stripe price is not configured");
      }

      // -----------------------------------------------
      // PREVENT DUPLICATE ACTIVE/TRIAL ORG
      // -----------------------------------------------

      const existingMembership = await tx.membership.findFirst({
        where: {
          userId,
          status: {
            in: [MembershipStatus.ACTIVE, MembershipStatus.INVITED],
          },
        },
      });

      // -----------------------------------------------
      // CREATE ORGANIZATION
      // -----------------------------------------------

      const randomNumber = Math.floor(100000 + Math.random() * 900000);

      const organizationSlug = `${name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")}-org-${randomNumber}`;

      const organization = await tx.organization.create({
        data: {
          name,
          email: user.email,
          slug: organizationSlug,
          phone,
          ownerUserId: userId,
          storageUsedBytes: plan.maxStorageMB,
          timezone,
          // Payment not completed yet.
          status: OrganizationStatus?.SUSPENDED,
        },
      });

      // -----------------------------------------------
      // CREATE OWNER MEMBERSHIP
      // -----------------------------------------------

      await tx.membership.create({
        data: {
          userId,
          organizationId: organization.id,
          orgRole: OrgRole.OWNER,
          status: MembershipStatus.INVITED,
          isActive: false,
          invitedAt: new Date(),
        },
      });

      return {
        user,
        plan,
        organization,
      };
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );

  // ===================================================
  // CREATE / REUSE STRIPE CUSTOMER
  // ===================================================

  let stripeCustomerId: string;

  /**
   * We can store stripeCustomerId on Subscription
   * later, but during first checkout we need a
   * Stripe customer.
   */

  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      organizationId: result.organization.id,
    },
  });

  if (existingSubscription?.stripeCustomerId) {
    stripeCustomerId = existingSubscription.stripeCustomerId;
  } else {
    const customer = await stripe.customers.create({
      email: result.user.email,
      name: result.user.name,

      metadata: {
        userId: result.user.id,
        organizationId: result.organization.id,
      },
    });

    stripeCustomerId = customer.id;
  }

  // ===================================================
  // CREATE CHECKOUT SESSION
  // ===================================================

  let checkoutSession: Stripe.Checkout.Session;

  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",

      customer: stripeCustomerId,

      line_items: [
        {
          price: result?.plan?.stripePriceId!,
          quantity: 1,
        },
      ],

      subscription_data: {
        trial_period_days: result.plan.trialDays || 7,

        metadata: {
          userId: result.user.id,
          organizationId: result.organization.id,
          planId: result.plan.id,
        },
      },

      payment_method_collection: "always",

      client_reference_id: result.organization.id,

      metadata: {
        userId: result.user.id,

        organizationId: result.organization.id,

        planId: result.plan.id,
      },

      success_url: `${config.frontend_url}/billing/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${config.frontend_url}/billing/cancel`,
    });
  } catch (error) {
    /**
     * Stripe Checkout creation failed.
     *
     * Organization was created already.
     *
     * Keep it suspended and let user retry,
     * or cleanup here if that is your business rule.
     */

    throw error;
  }

  return {
    organizationId: result.organization.id,

    sessionId: checkoutSession.id,

    url: checkoutSession.url,
  };
};

// =====================================================
// STRIPE WEBHOOK
// =====================================================

const handleWebhook = async (payload: Buffer, signature: string) => {
  const endpointSecret = config.stripe_webhook_secret;

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    endpointSecret,
  );

  switch (event.type) {
    // -----------------------------------------------
    // CHECKOUT COMPLETED
    // -----------------------------------------------

    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;

    // -----------------------------------------------
    // SUBSCRIPTION UPDATED
    // -----------------------------------------------

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    // -----------------------------------------------
    // SUBSCRIPTION DELETED / CANCELED
    // -----------------------------------------------
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    // -----------------------------------------------
    // INVOICE PAID
    // -----------------------------------------------

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    // -----------------------------------------------
    // PAYMENT FAILED
    // -----------------------------------------------

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    // -----------------------------------------------
    // TRIAL ENDING SOON
    // -----------------------------------------------

    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(event.data.object as Stripe.Subscription);
      break;

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }
};

// =====================================================
// CANCEL SUBSCRIPTION
// =====================================================

const cancelSubscription = async (userId: string, organizationId: string) => {
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const membership = await tx.membership.findFirst({
        where: {
          userId,
          organizationId,

          status: MembershipStatus.ACTIVE,

          orgRole: {
            in: [OrgRole.OWNER],
          },
        },
      });

      if (!membership) {
        throw new Error("You are not authorized to cancel this subscription");
      }

      const subscription = await tx.subscription.findUnique({
        where: {
          organizationId,
        },
      });

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      if (!subscription.stripeSubscriptionId) {
        throw new Error("Stripe subscription not found");
      }

      if (
        subscription.status === SubscriptionStatus.CANCELED ||
        subscription.status === SubscriptionStatus.EXPIRED
      ) {
        throw new Error("Subscription is already canceled");
      }

      /**
       * Immediate cancellation.
       *
       * If status is TRIALING:
       * no money will be charged.
       *
       * Stripe webhook will later handle:
       * customer.subscription.deleted
       */

      const canceled = await stripe.subscriptions.cancel(
        subscription.stripeSubscriptionId,
      );

      return {
        subscriptionId: canceled.id,

        status: canceled.status,
      };
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
  return transactionResult;
};

// =====================================================
// GET SUBSCRIPTION STATUS
// =====================================================

const getSubscriptionStatus = async (
  userId: string,
  organizationId: string,
): Promise<ISubscriptionStatusResponse> => {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      organizationId,

      status: {
        in: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED],
      },
    },
  });

  if (!membership) {
    throw new Error("Organization membership not found");
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      organizationId,
    },

    include: {
      plan: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const isActive =
    (subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.ACTIVE) &&
    (!subscription.trialEnd || subscription.trialEnd > new Date());

  return {
    organizationId,

    planName: subscription.plan.name,

    status: subscription.status,

    isActive,

    trialStart: subscription.trialStart,

    trialEnd: subscription.trialEnd,

    currentPeriodStart: subscription.currentPeriodStart,

    currentPeriodEnd: subscription.currentPeriodEnd,

    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
};

export const billingService = {
  createCheckoutSession,
  handleWebhook,
  cancelSubscription,
  getSubscriptionStatus,
};
