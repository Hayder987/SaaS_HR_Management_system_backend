import z from "zod";

const createOrganizationValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(150, "Organization name cannot exceed 150 characters"),

  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(100, "Slug cannot exceed 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase letters, numbers and hyphens",
    ),

  email: z.string().trim().email("Invalid organization email"),

  phone: z
    .string()
    .trim()
    .max(30, "Phone number cannot exceed 30 characters")
    .optional(),

  address: z
    .string()
    .trim()
    .max(500, "Address cannot exceed 500 characters")
    .optional(),

  logoUrl: z.string().url("Invalid logo URL").optional(),

  locationName: z
    .string()
    .trim()
    .max(150, "Location name cannot exceed 150 characters")
    .optional(),

  latitude: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),

  longitude: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),

  attendanceRadiusMeters: z
    .number()
    .int("Attendance radius must be an integer")
    .min(10, "Attendance radius must be at least 10 meters")
    .max(10000, "Attendance radius cannot exceed 10000 meters")
    .optional(),

  timezone: z.string().trim().min(1).max(100).optional(),

  currency: z
    .string()
    .trim()
    .length(3, "Currency must be a 3-letter code")
    .transform((value) => value.toUpperCase())
    .optional(),
});

export const organizationValidation = {
  createOrganizationValidationSchema,
};
