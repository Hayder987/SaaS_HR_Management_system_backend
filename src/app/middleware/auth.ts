import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { UserRole, UserStatus } from "../../generated/prisma/enums";
import { jwtUtils } from "../utils/jwt";
import config from "../config";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        role: UserRole;
        email: string;
        isEmailVerified: boolean;
      };
    }
  }
}

export const auth = (...requiredRole: UserRole[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization?.split(" ")[1]
        : req.headers.authorization;

    if (!token) {
      throw new Error(
        "You are not logged in. Please log in to access this resource.",
      );
    }

    const verifyAuthToken = jwtUtils.verifyToken(
      token,
      config.jwt_access_secret,
    );

    if (!verifyAuthToken.success) {
      throw new Error(verifyAuthToken.error);
    }

    const { id, name, role, email, isEmailVerified } =
      verifyAuthToken.data as JwtPayload;

    if (!id) {
      throw new Error("Invalid access token. User ID is missing.");
    }

    if (!name) {
      throw new Error("Invalid access token. Name is missing.");
    }

    if (!email) {
      throw new Error("Invalid access token. Email is missing.");
    }

    if (!isEmailVerified) {
      throw new Error("Invalid access token. Email Not Verified.");
    }

    if (!role) {
      throw new Error("Invalid access token. User role is missing.");
    }

    if (requiredRole.length && !requiredRole.includes(role)) {
      throw new Error(
        "Forbidden. You don't have permission to access this resource.",
      );
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
        email,
        name,
        role,
        isEmailVerified,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isEmailVerified: true,
      },
    });

     if (!user) {
      throw new Error("User not found. Please log in again.");
    }

     if (user.status === UserStatus.SUSPENDED) {
      throw new Error(
        "Your account has been suspended. Please contact support.",
      );
    }

    if (user.status === UserStatus.DELETED) {
      throw new Error(
        "Your account has been deleted. Please contact support.",
      );
    }

    if (user.email !== email) {
      throw new Error("Invalid access token. Please log in again.");
    }

    if (user.role !== role) {
      throw new Error("Your account permissions have changed. Please log in again.");
    }

    req.user = {
      id: user.id,
      name : user.name,
      role: user.role,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    };

    next();
  });
};
