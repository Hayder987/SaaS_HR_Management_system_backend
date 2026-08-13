import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  // 15 minutes
  windowMs: 15 * 60 * 1000,

  // Maximum 10 authentication requests
  limit: 5,

  // Send standard RateLimit headers
  standardHeaders: "draft-8",

  // Disable legacy headers
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },

  statusCode: 429,
});