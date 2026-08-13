import { redisClient } from "../lib/redis";
import crypto from "crypto";

export const generateOtp = async (key: string, otp:string) => {
  
  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });
};
