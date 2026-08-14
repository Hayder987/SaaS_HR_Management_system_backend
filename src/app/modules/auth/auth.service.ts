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
import {
  AuthMethod,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import path from "path";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";
import { redisClient } from "../../lib/redis";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { createOtp, passwordHash, setRedisOtp } from "../../utils/common.util";
import { OAuth2Client, TokenPayload } from "google-auth-library";

const googleClient = new OAuth2Client(
  config.google_client_id,
  config.google_client_secret,
  config.google_redirect_uri,
);

interface IGoogleLoginPayload {
  code: string;
}


// resister user
const registerUser = async (payload: IRegisterUser) => {
  const name = payload.name.trim();
  const email = payload.email.trim().toLowerCase();
  const password = payload.password;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      isEmailVerified: true,
      email: true,
    },
  });

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await passwordHash(password);

  const otp = createOtp();
  const email_redisKey = `user_registration:${email}`;
  const verify_redisKey = `verify_otp:${email}`;
  const expirationSeconds = 5 * 60;

  await redisClient.set(
    email_redisKey,
    JSON.stringify({
      name,
      email,
      hashedPassword,
      otp,
    }),
    {
      expiration: {
        type: "EX",
        value: expirationSeconds,
      },
    },
  );

  await setRedisOtp(verify_redisKey, otp);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/verify-email.ejs",
  );

  const templateData = {
    name,
    otp,
    expirationMinutes: 5,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: email,
    subject: "verify Email ",
    html,
  });
};

// verify email
const verifyEmail = async (payload: IVerifyEmailPayload) => {
  const otp = payload?.otp;
  const email = payload.email.trim().toLowerCase();

  const verify_redisKey = `verify_otp:${email}`;

  const redisOtp = await redisClient.get(verify_redisKey);

  if (!redisOtp) {
    throw new Error("Invalid OTP Or Expired");
  }

  if (redisOtp !== otp) {
    throw new Error("OTP Does Not Match");
  }

  await redisClient.del(verify_redisKey);

  const email_redisKey = `user_registration:${email}`;
  const redisStoredData = await redisClient.get(email_redisKey);

  if (!redisStoredData) {
    throw new Error(
      "Verification code expired or registration session not found",
    );
  }

  const registrationData = JSON.parse(redisStoredData);

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (isUserExist) {
    if (isUserExist.isEmailVerified) {
      throw new Error("Email is already verified");
    }

    if (isUserExist.status === UserStatus.SUSPENDED) {
      throw new Error("You Are SUSPEND! ");
    }

    if (isUserExist.status === UserStatus.DELETED) {
      throw new Error("You Are DELETED! ");
    }

    if (!isUserExist.password) {
      throw new Error("User Google Authenticated");
    }
  }

  const onboardingDeadline = new Date();

  onboardingDeadline.setDate(
    onboardingDeadline.getDate() + 3,
  );

  const user = await prisma.user.create({
    data: {
      name: registrationData.name,
      email: registrationData.email,
      password: registrationData.passwordHash,
      onboardingDeadline : onboardingDeadline,
      authMethod: AuthMethod.CREDENTIALS,
      role: UserRole.PLATFORM_USER,
      status: UserStatus.ACTIVE,

      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },

    select: {
      id: true,
      name: true,
      email: true,
      authMethod: true,
      role: true,
      status: true,
      isEmailVerified: true,
      emailVerifiedAt: true,
      createdAt: true,
    },
  });

  // Delete OTP/session from Redis
  await redisClient.del(email_redisKey);

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/email-verified-success.ejs",
  );

  const templateData = {
    name: user.name,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  await transporter.sendMail({
    from: config.email_sender,
    to: user.email,
    subject: "Email Verified SuccessFully",
    html,
  });
};

// login platformUser superAdmin by credential
const loginUser = async (payload: ILoginUser) => {
  const { password } = payload;

  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    throw new Error("User Not Found ! Please Register");
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("User is suspended");
  }

  if (user.status === UserStatus.DELETED) {
    throw new Error("User is deleted");
  }

  if (!user.isEmailVerified) {
    throw new Error("Email not verified. Please verify your email");
  }

  if (user.authMethod !== AuthMethod.CREDENTIALS) {
    throw new Error(
      "Password login is not available for this account. Please use Google login",
    );
  }

  if (!user.password) {
    throw new Error("Password login is not available for this account");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid email or password");
  }

  const lastLoginAt = new Date();

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt,
    },
  });

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
        authMethod: user.authMethod,
        isEmailVerified: user.isEmailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt,
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

      organization: {
        status: "ACTIVE",
      },
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
          slug: true,
          logo: true,
          locationName: true,
          timezone: true,
          currency: true,
          status: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
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

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authMethod: user.authMethod,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt,
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

  const otp = createOtp();
  const key = `forgot-password-otp:${isUserExist.email}`;

  await setRedisOtp(key, otp);

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

  const otp = createOtp();

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


// google login
const googleLogin = async (payload: IGoogleLoginPayload) => {

  const { tokens } = await googleClient.getToken({
    code: payload.code,
    redirect_uri: config.google_redirect_uri,
  });

  if (!tokens.id_token) {
    throw new Error("Google ID Token Not Found");
  }

  let googleIdTokenPayload: TokenPayload | undefined;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.log("Google ID Token Verification Failed", error);

    throw new Error("Invalid Or Expired Google ID Token");
  }

  if (!googleIdTokenPayload) {
    throw new Error("Invalid Or Expired Google ID Token");
  }

  if (!googleIdTokenPayload.email) {
    throw new Error("Google Email Not Found");
  }

  if (googleIdTokenPayload.email_verified !== true) {
    throw new Error("Google Email Is Not Verified");
  }

  if (!googleIdTokenPayload.name) {
    throw new Error("Google User Name Not Found");
  }

  const email = googleIdTokenPayload.email
  .trim()
  .toLowerCase();

  let user = await prisma.user.findUnique({
    where: {
      email
    },
  });

  if(user?.authMethod === AuthMethod.CREDENTIALS && user?.password){
   throw new Error("An account already exists with this email. Please login using your email and password.")
  }

  const onboardingDeadline = new Date();

  onboardingDeadline.setDate(
    onboardingDeadline.getDate() + 3,
  );

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: googleIdTokenPayload.name,
        email: googleIdTokenPayload.email,
        password: null,
        authMethod: AuthMethod.GOOGLE,
        role: UserRole.PLATFORM_USER,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        onboardingDeadline: onboardingDeadline, 
        lastLoginAt: new Date(),
      },
    });
  }


  if (user.status === UserStatus.SUSPENDED) {
    throw new Error("User Is SUSPENDED");
  }

  if (user.status === UserStatus.DELETED) {
    throw new Error("User Is DELETED");
  }

  user = await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        name: user.name,
        isEmailVerified: true,
        emailVerifiedAt:
        user.emailVerifiedAt ?? new Date(),

        lastLoginAt: new Date(),

      },
    });

  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",

      organization: {
        status: "ACTIVE",
      },
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
          slug: true,
          logo: true,
          locationName: true,
          timezone: true,
          currency: true,
          status: true,
        },
      },
    },

    orderBy: {
      createdAt: "asc",
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

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      authMethod: user.authMethod,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt : user.lastLoginAt,
    },

    access: {
      type: memberships.length > 0 ? "ORGANIZATION" : "PLATFORM",

      organizationAccess: memberships.length > 0,
    },

    memberships,
  };
};



export const authServices = {
  registerUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendOtp,
  loginUser,
  googleLogin

};
