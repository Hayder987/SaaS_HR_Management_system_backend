export interface ICreateCheckoutResponse {
  organizationId: string;
  sessionId: string;
  url: string | null;
}

export interface ICreateOrganizationCheckOut {
  planId : string;
  name : string;
  phone : string;
  timezone ?: string;
}

export interface ISubscriptionStatusResponse {
  organizationId: string;
  planName: string;
  status: string;
  isActive: boolean;
  trialStart: Date | null;
  trialEnd: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}