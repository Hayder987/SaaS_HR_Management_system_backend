import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import ejs from "ejs";
import {
  IForgotPassword,
  ILoginUser,
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
import { jwtUtils } from "../../utils/jwt";
import { SignOptions } from "jsonwebtoken";

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

// login platformUser superAdmin
const loginUser = async (payload: ILoginUser) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.isEmailVerified) {
    throw new Error("Email not verified. Please verify your email");
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("User is suspended");
  }

  if (user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  if (!user.password) {
    throw new Error("Password login is not available for this account");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid email or password");
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    const jwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwtUtils.createToken(
      jwtPayload,
      config.jwt_access_secret,
      config.jwt_access_expires_in as SignOptions,
    );

    const refreshToken = jwtUtils.createToken(
      jwtPayload,
      config.jwt_refresh_secret,
      config.jwt_refresh_expires_in as SignOptions,
    );

    return {
      accessToken,
      refreshToken,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },

      access: {
        type: "PLATFORM",
        organizationAccess: true,
      },

      memberships: [],
    };
  }

  // PLATFORM USER
  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
    },

    select: {
      id: true,
      organizationId: true,
      role: true,
      status: true,

      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const jwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  //Return Login Result
  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isPremiumOwner: user.isPremiumOwner,
      organizationOwner: user.organizationOwner,
      planName: user.planeName,
    },

    access: {
      type: memberships.length > 0 ? "ORGANIZATION" : "PLATFORM",

      organizationAccess: memberships.length > 0,
    },

    memberships,
  };
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
  loginUser,
};
