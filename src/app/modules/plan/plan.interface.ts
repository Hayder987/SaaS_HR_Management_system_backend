import { BillingInterval, PlanName } from "../../../generated/prisma/enums";


export interface ICreateFeature {
  key: string;
  name: string;
  description?: string;
}

export interface IUpdateFeature {
  key?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ICreatePlan {
  name: PlanName;
  displayName: string;
  description?: string;
  price: number;
  currency?: "USD";
  billingInterval?: BillingInterval;
  maxAdmins: number;
  maxHRs: number;
  maxManagers: number;
  maxEmployees: number;
  maxStorageMB: number;
  isPopular?: boolean;
  sortOrder?: number;
  featureIds?: string[];
}

export interface IUpdatePlan {
  displayName?: string;
  description?: string | null;
  price?: number;
  currency?: "USD";
  billingInterval?: BillingInterval;
  maxAdmins?: number;
  maxHRs?: number;
  maxManagers?: number;
  maxEmployees?: number;
  maxStorageMB?: number;
  isPopular?: boolean;
  sortOrder?: number;
  featureIds?: string[];
}
