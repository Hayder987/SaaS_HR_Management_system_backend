import rateLimit from "express-rate-limit";

export const apiRateLimiter = rateLimit({
  // 15 minutes
  windowMs: 15 * 60 * 1000,

  // Maximum 100 requests per window
  limit: 100,

  // Send standard RateLimit headers
  standardHeaders: "draft-8",

  // Disable old X-RateLimit-* headers
  legacyHeaders: false,

  // Response when limit is exceeded
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },

  // HTTP status for rate limit
  statusCode: 429,
});