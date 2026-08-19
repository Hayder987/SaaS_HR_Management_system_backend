export interface ICheckoutResponse {
  sessionId: string;
  url: string | null;
}

export interface ISubscriptionStatusResponse {
  status: string;
  isSubscribed: boolean;
  isPremium: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
}