import { BillingInterval } from "../../../generated/prisma/enums";


export interface ICreateCheckoutSession {
  planId: string;
}

export interface ICheckoutResponse {
  sessionId: string;
  url: string | null;
}

export interface IStripeWebhookResponse {
  received: boolean;
}

export interface ICreateSubscriptionData {
  userId: string;
  planId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}

export interface IPlanPrice {
  price: number;
  billingInterval: BillingInterval;
}