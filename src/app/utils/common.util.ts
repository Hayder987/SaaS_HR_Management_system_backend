import bcrypt from "bcryptjs";
import config from "../config";
import { redisClient } from "../lib/redis";
import crypto from "crypto";

// password hashing
export const passwordHash = async (password: string) => {
  return await bcrypt.hash(password, Number(config.bcrypt_salt_rounds));
};

export const createOtp = () =>{
  return crypto.randomInt(100000, 1000000).toString(); 
}

export const setRedisOtp = async (key: string, otp:string) => {
  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });
};

