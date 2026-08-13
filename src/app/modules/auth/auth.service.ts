import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import ejs from "ejs";
import {
  IForgotPassword,
  IRegisterUser,
  IResetPassword,
  IVerifyEmailPayload,
} from "./auth.interface";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";
import crypto from "crypto";
import { generateOtp } from "../../utils/createOtp";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";
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

  if (!createUser.isEmailVerified) {
    const otp = crypto.randomInt(100000, 1000000).toString();
    const key = `email-verification:${createUser.email}`;

    await generateOtp(key, otp);

    const templatePath = path.join(
      process.cwd(),
      "src/app/templates/verify-email.ejs",
    );

    const templateData = {
      name: createUser.name,
      otp,
      expirationMinutes: 5,
    };

    const html = await ejs.renderFile(templatePath, templateData);

    await transporter.sendMail({
      from: config.email_sender,
      to: createUser.email,
      subject: "verify Email",
      html,
    });
  }
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

  await generateOtp(key, otp);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/forgot-password.ejs",
  );

  const templateData = {
    name: isUserExist.name,
    otp,
    expirationMinutes: 5,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: "Forgot Password",
    html,
  });
};

// reset password
const resetPassword = async (payload: IResetPassword) => {
  const { email, otp, newPassword } = payload;

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

  const key = `forgot-password-otp:${isUserExist.email}`;
  const redisOtp = await redisClient.get(key);

  if (!redisOtp) {
    throw new Error("Invalid OTP");
  }

  if (redisOtp !== otp) {
    throw new Error("OTP Does Not Match");
  }

  const hashedNewPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await prisma.user.update({
    where: {
      email: isUserExist.email,
    },
    data: {
      password: hashedNewPassword,
    },
  });

  await redisClient.del([key]);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/reset-password-success.ejs",
  );

  const templateData = {
    name: isUserExist.name,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: "Password Changed",
    html,
  });
};

// verify email
const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const { email, otp } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User Does Not Exist!");
  }

  if (isUserExist.isEmailVerified) {
    throw new Error("Email is already verified");
  }

  if (isUserExist.status !== UserStatus.ACTIVE) {
    throw new Error("User Maybe Suspend Or Blocked");
  }

  const key = `email-verification:${isUserExist.email}`;
  const redisOtp = await redisClient.get(key);

  if (!redisOtp) {
    throw new Error("Invalid OTP");
  }

  if (redisOtp !== otp) {
    throw new Error("OTP Does Not Match");
  }

  await prisma.user.update({
    where: {
      email: isUserExist.email,
    },
    data: {
      isEmailVerified: true,
    },
  });

  await redisClient.del([key]);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/email-verified-success.ejs",
  );

  const templateData = {
    name: isUserExist.name,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: "Email Verified SuccessFully",
    html,
  });
};

// resend otp email verify and forgot password
const resendOtp = async (payload: any) => {
  const { email, emailVerify } = payload;

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

  if (emailVerify && isUserExist.isEmailVerified) {
    throw new Error("Email Already Verified");
  }

  if (!emailVerify && !isUserExist.isEmailVerified) {
    throw new Error("Email Not Verified Verified");
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  const emailKey = `email-verification:${isUserExist.email}`;
  const forgotKey = `forgot-password-otp:${isUserExist.email}`;
  const expirationSeconds = 5 * 60;

  const key = emailVerify ? emailKey : forgotKey;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/resend-otp.ejs",
  );

  const templateData = {
    name: isUserExist.name,
    otp,
    expirationMinutes: 5,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: `New Verification Code Send SuccessFully`,
    html,
  });
};



export const authServices = {
  registerUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendOtp,
};
