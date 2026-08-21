import Stripe from "stripe";

import {
  MembershipStatus,
  OrganizationStatus,
  paymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { stripe } from "../../lib/stripe";
import { prisma } from "../../lib/prisma";
import { sendSubscriptionSuccessEmail } from "../../services/email.service";

// =====================================================
// GET SUBSCRIPTION ID FROM INVOICE
// Stripe SDK v22+
// =====================================================

const getInvoiceSubscriptionId = (invoice: Stripe.Invoice): string | null => {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (!subscription) {
    return null;
  }

  if (typeof subscription === "string") {
    return subscription;
  }

  return subscription.id;
};

// =====================================================
// GET PAYMENT INTENT ID FROM INVOICE
// Stripe SDK v22+
// =====================================================

const getInvoicePaymentIntentId = (invoice: Stripe.Invoice): string | null => {
  const invoicePayment = invoice.payments?.data?.[0];

  if (!invoicePayment) {
    return null;
  }

  const payment = invoicePayment.payment;

  if (!payment) {
    return null;
  }

  const paymentIntent = payment.payment_intent;

  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  return paymentIntent.id;
};

// =====================================================
// STRIPE PERIOD HELPERS
// =====================================================

export const getPeriodEnd = (payload: Stripe.Subscription) => {
  const timestamp = payload.items.data[0]?.current_period_end;

  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000);
};

export const getPeriodStart = (payload: Stripe.Subscription) => {
  const timestamp = payload.items.data[0]?.current_period_start;

  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000);
};

export const getTrialStart = (payload: Stripe.Subscription) => {
  return payload.trial_start ? new Date(payload.trial_start * 1000) : null;
};

export const getTrialEnd = (payload: Stripe.Subscription) => {
  return payload.trial_end ? new Date(payload.trial_end * 1000) : null;
};

// =====================================================
// CHECKOUT SESSION COMPLETED
// =====================================================

export const handleCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
) => {
  if (!session) {
    return;
  }

  const userId = session.metadata?.userId;

  const organizationId = session.metadata?.organizationId;

  const planId = session.metadata?.planId;

  const stripeCustomerId =
    typeof session.customer === "string" ? session.customer : null;

  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  if (
    !userId ||
    !organizationId ||
    !planId ||
    !stripeCustomerId ||
    !stripeSubscriptionId
  ) {
    console.error("Checkout webhook missing metadata");

    return;
  }

  // -----------------------------------------------
  // Retrieve Stripe subscription
  // -----------------------------------------------

  const stripeSubscription =
    await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const trialStart = getTrialStart(stripeSubscription);

  const trialEnd = getTrialEnd(stripeSubscription);

  const currentPeriodStart = getPeriodStart(stripeSubscription);

  const currentPeriodEnd = getPeriodEnd(stripeSubscription);

  // -----------------------------------------------
  // DB transaction
  // -----------------------------------------------

  await prisma.$transaction(
    async (tx) => {
      // -------------------------------------------
      // Verify organization
      // -------------------------------------------

      const organization = await tx.organization.findUnique({
        where: {
          id: organizationId,
        },
      });

      if (!organization) {
        throw new Error("Organization not found");
      }

      // -------------------------------------------
      // Verify plan
      // -------------------------------------------

      const plan = await tx.plan.findUnique({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new Error("Plan not found");
      }

      // -------------------------------------------
      // Upsert subscription
      // -------------------------------------------

      await tx.subscription.upsert({
        where: {
          organizationId,
        },

        create: {
          organizationId,
          planId,
          userId,
          stripeCustomerId,
          stripeSubscriptionId,

          status:
            stripeSubscription.status === "trialing"
              ? SubscriptionStatus.TRIALING
              : SubscriptionStatus.ACTIVE,

          trialStart,
          trialEnd,

          currentPeriodStart,
          currentPeriodEnd,

          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },

        update: {
          planId,

          stripeCustomerId,
          stripeSubscriptionId,

          status:
            stripeSubscription.status === "trialing"
              ? SubscriptionStatus.TRIALING
              : SubscriptionStatus.ACTIVE,

          trialStart,
          trialEnd,

          currentPeriodStart,
          currentPeriodEnd,

          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        },
      });

      // -------------------------------------------
      // Activate organization
      // -------------------------------------------
      const onboardingDeadline = new Date();
      onboardingDeadline.setDate(onboardingDeadline.getDate() + 30);

      await tx.organization.update({
        where: {
          id: organizationId,
        },

        data: {
          status: OrganizationStatus.ACTIVE,
          onboardingDeadline,
        },
      });

      // -------------------------------------------
      // Activate owner membership
      // -------------------------------------------

      await tx.membership.updateMany({
        where: {
          organizationId,
          userId,
        },

        data: {
          status: MembershipStatus.ACTIVE,
          isActive: true,
        },
      });

      // -----------------------------------------------
      // Set Current Organization user
      // -----------------------------------------------
       
       await tx.user.update({
        where : {
          id : userId
        },
        data : {
         activeOrgId : organization.id 
        }
      })

      // -------------------------------------------
      // IMPORTANT:
      //
      // DO NOT create PAID payment here.
      //
      // Because this is a free trial.
      //
      // Actual payment will be recorded from
      // invoice.paid.
      // -------------------------------------------
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
};

// =====================================================
// SUBSCRIPTION UPDATED
// =====================================================

export const handleSubscriptionUpdated = async (
  payload: Stripe.Subscription,
) => {
  const stripeSubscriptionId = payload.id;

  const subscriptionStatus = payload.status;

  const currentPeriodStart = getPeriodStart(payload);

  const currentPeriodEnd = getPeriodEnd(payload);

  const trialStart = getTrialStart(payload);

  const trialEnd = getTrialEnd(payload);

  let status: SubscriptionStatus;

  switch (subscriptionStatus) {
    case "trialing":
      status = SubscriptionStatus.TRIALING;
      break;

    case "active":
      status = SubscriptionStatus.ACTIVE;
      break;

    case "past_due":
      status = SubscriptionStatus.PAST_DUE;
      break;

    case "canceled":
      status = SubscriptionStatus.CANCELED;
      break;

    case "incomplete":
      status = SubscriptionStatus.INCOMPLETE;
      break;

    default:
      status = SubscriptionStatus.EXPIRED;
  }

  await prisma.$transaction(
    async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: {
          stripeSubscriptionId,
        },
      });

      if (!subscription) {
        console.log(`Subscription not found: ${stripeSubscriptionId}`);

        return;
      }

      await tx.subscription.update({
        where: {
          id: subscription.id,
        },

        data: {
          status,

          currentPeriodStart,
          currentPeriodEnd,

          trialStart,
          trialEnd,

          cancelAtPeriodEnd: payload.cancel_at_period_end,

          canceledAt: payload.canceled_at
            ? new Date(payload.canceled_at * 1000)
            : null,
        },
      });

      // -------------------------------------------
      // ACTIVE / TRIALING
      // -------------------------------------------

      if (
        status === SubscriptionStatus.ACTIVE ||
        status === SubscriptionStatus.TRIALING
      ) {
        await tx.organization.update({
          where: {
            id: subscription.organizationId,
          },

          data: {
            status: OrganizationStatus.ACTIVE,
          },
        });
      }
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
};

// =====================================================
// SUBSCRIPTION DELETED / CANCELED
// =====================================================

export const handleSubscriptionDeleted = async (
  payload: Stripe.Subscription,
) => {
  const stripeSubscriptionId = payload.id;

  await prisma.$transaction(
    async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: {
          stripeSubscriptionId,
        },
      });

      if (!subscription) {
        console.log(`Subscription not found: ${stripeSubscriptionId}`);

        return;
      }

      // -----------------------------------------
      // Subscription
      // -----------------------------------------

      await tx.subscription.update({
        where: {
          id: subscription.id,
        },

        data: {
          status: SubscriptionStatus.CANCELED,

          canceledAt: new Date(),
        },
      });

      // -----------------------------------------
      // Organization
      // -----------------------------------------

      await tx.organization.update({
        where: {
          id: subscription.organizationId,
        },

        data: {
          status: OrganizationStatus.SUSPENDED,
        },
      });

      // -----------------------------------------
      // Organization memberships
      // -----------------------------------------

      await tx.membership.updateMany({
        where: {
          organizationId: subscription.organizationId,

          status: MembershipStatus.ACTIVE,
        },

        data: {
          status: MembershipStatus.SUSPENDED,

          isActive: false,
        },
      });
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );
};

// =====================================================
// INVOICE PAID
// =====================================================

export const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    console.log(`No subscription found in invoice: ${invoice.id}`);

    return;
  }
  // ---------------------------------------------------
  // 2. Find local subscription
  // ---------------------------------------------------

 const subscription =
  await prisma.subscription.findUnique({
    where: {
      stripeSubscriptionId,
    },
  });

  if (!subscription) {
    console.log(`Subscription not found for invoice: ${invoice.id}`);

    return;
  }

  const paymentIntentId = getInvoicePaymentIntentId(invoice);

  const amount = Number(invoice.amount_paid) / 100;

  if (amount <= 0) {
    console.log(
      `Invoice ${invoice.id} has no charge. Skipping payment creation.`,
    );

    return;
  }

  // ---------------------------------------------------
  // 5. Database transaction
  // ---------------------------------------------------

  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const existingPayment = await tx.payment.findUnique({
        where: {
          stripeInvoiceId: invoice.id,
        },
      });

      if (existingPayment) {
        console.log(`Invoice already processed: ${invoice.id}`);

        return;
      }

      // -----------------------------------------------
      // Create payment
      // -----------------------------------------------

      const updatedPayment = await tx.payment.create({
        data: {
          organizationId: subscription.organizationId,

          subscriptionId: subscription.id,

          stripeInvoiceId: invoice.id,

          stripePaymentIntentId: paymentIntentId,

          amount: amount.toString(),

          currency: invoice.currency.toUpperCase(),

          paymentMethod: paymentMethod.STRIPE,

          status: PaymentStatus.PAID,

          paidAt: new Date(),
        },
      });

      // -----------------------------------------------
      // Subscription ACTIVE
      // -----------------------------------------------

      const updatedSubscription = await tx.subscription.update({
        where: {
          id: subscription.id,
        },

        data: {
          status: SubscriptionStatus.ACTIVE,
          trialStart: null,
          trialEnd: null,

          currentPeriodStart: new Date(invoice.period_start * 1000),
          currentPeriodEnd: new Date(invoice.period_end * 1000),
        },
      });

      // -----------------------------------------------
      // Organization ACTIVE
      // -----------------------------------------------

      const updatedOrganization = await tx.organization.update({
        where: {
          id: subscription.organizationId,
        },

        data: {
          status: OrganizationStatus.ACTIVE,
          onboardingDeadline: null,
        },
      });


      // -----------------------------------------------
      // Memberships ACTIVE
      // -----------------------------------------------

      const updatedMembership = await tx.membership.updateMany({
        where: {
          organizationId: subscription.organizationId,

          status: MembershipStatus.SUSPENDED,
        },

        data: {
          status: MembershipStatus.ACTIVE,

          isActive: true,
        },
      });

      return {
        payment: updatedPayment,
        subscription: updatedSubscription,
        organization: updatedOrganization,
        membership: updatedMembership,
      };
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );

  const user = await prisma.user.findUnique({
    where : {
      id : subscription.userId
    }
  })

  const plan = await prisma.plan.findUnique({
    where : {
      id : subscription.planId
    }
  })

  const voucherNumber = `HR-VOUCHER-${transactionResult?.payment?.id
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase()}`;

  console.log(`Invoice paid successfully: ${invoice.id}`);

  try {
    await sendSubscriptionSuccessEmail({
      voucherNumber,
      customerName: user?.name!,
      customerEmail: user?.email!,
      planName: plan?.name!,
      amount: transactionResult?.payment.amount.toString()!,
      currency: transactionResult?.payment.currency!,
      paymentDate: transactionResult?.payment.paidAt ?? new Date(),
      periodStart: transactionResult?.subscription?.currentPeriodStart!,
      periodEnd: transactionResult?.subscription.currentPeriodEnd!,
      stripeInvoiceId : transactionResult?.payment?.stripeInvoiceId!,
      stripePaymentIntentId : transactionResult?.payment?.stripePaymentIntentId!,
      stripeSubscriptionId,
    });

    console.log(`Subscription success email sent to ${user?.email}`);
  } catch (error) {
    console.error("Failed to send subscription success email:", error);
  }
};

// =====================================================
// INVOICE PAYMENT FAILED
// =====================================================
export const handleInvoicePaymentFailed = async (invoice: Stripe.Invoice) => {
  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);

  if (!stripeSubscriptionId) {
    console.log(`No subscription found in failed invoice: ${invoice.id}`);

    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: {
      stripeSubscriptionId,
    },
  });

  if (!subscription) {
    console.log(`Subscription not found for failed invoice: ${invoice.id}`);

    return;
  }

  // ---------------------------------------------------
  // 3. Update subscription
  // ---------------------------------------------------

  await prisma.$transaction(
    async (tx) => {
      await tx.subscription.update({
        where: {
          id: subscription.id,
        },

        data: {
          status: SubscriptionStatus.PAST_DUE,
        },
      });
    },
    {
      maxWait: 15000,
      timeout: 20000,
    },
  );

  console.log(`Subscription marked as PAST_DUE. Invoice: ${invoice.id}`);
};
// =====================================================
// TRIAL WILL END
// =====================================================

export const handleTrialWillEnd = async (payload: Stripe.Subscription) => {
  const organizationId = payload.metadata?.organizationId;

  if (!organizationId) {
    return;
  }

  console.log(`Trial will end soon for organization: ${organizationId}`);

  // TODO:
  // sendSubscriptionTrialEndingEmail(...)
};
