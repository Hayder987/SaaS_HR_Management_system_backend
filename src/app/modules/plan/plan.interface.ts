import { PlanName } from "../../../generated/prisma/enums";

export interface ICreatePlan {
  name: PlanName;
  price: number;
  maxAdmins: number;
  maxHRs: number;
  maxEmployees: number;
}