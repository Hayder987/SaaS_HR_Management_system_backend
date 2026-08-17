import { PlanName } from "../../../generated/prisma/enums";

export interface ICreateCheckout {
  planId: string;

  organization: {
    name: string;
    slug: string;
    email: string;
    phone?: string;
    address?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
}

export interface ICheckoutResponse {
  sessionId: string;
  checkoutUrl: string;

  plan: {
    id: string;
    name: PlanName;
    displayName: string;
    price: number;
    currency: string;
    billingInterval: string;
    trialDays: number;
  };
}