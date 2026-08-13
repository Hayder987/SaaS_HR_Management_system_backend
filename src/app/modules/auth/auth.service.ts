import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import {
  IForgotPassword,
  IRegisterUser,
  IResetPassword,
} from "./auth.interface";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";

// resister user
const registerUser = async (payload: IRegisterUser) => {
  const { name, password } = payload;
  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const createUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: UserRole.PLATFORM_USER,
      status: UserStatus.ACTIVE,
      isEmailVerified: false,
    },
    omit: {
      password: true,
    },
  });

  return createUser;
};

// forgot password
const forgotPassword = async (payload: IForgotPassword) => {
  const { email } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User Does Not Exist!");
  }

  if (isUserExist.status !== UserStatus.ACTIVE) {
    throw new Error("User Maybe Suspend Or Blocked");
  }

  if (!isUserExist.isEmailVerified) {
    throw new Error("User Not Verified");
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  const key = `forgot-password-otp:${isUserExist.email}`;

  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  



};

// reset password
const resetPassword = async (payload: IResetPassword) => {};

export const authServices = {
  registerUser,
  forgotPassword,
  resetPassword,
};
