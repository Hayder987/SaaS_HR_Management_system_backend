
export interface ICreateOrganizationPayload {
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  attendanceRadiusMeters?: number;
  timezone?: string;
  currency?: string;
}
