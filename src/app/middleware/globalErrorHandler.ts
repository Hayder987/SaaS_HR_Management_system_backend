import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";

import config from "../config";
import logger from "../utils/logger";

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;

  let errorMessage: string =
    err.message || "Internal Server Error";

  const errorName: string =
    err.name || "Internal Server Error";

  // --------------------------------
  // Prisma Validation Error
  // --------------------------------

  if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;

    errorMessage =
      "You have provided incorrect field type or missing fields";
  }

  // --------------------------------
  // Prisma Known Request Error
  // --------------------------------

  else if (
    err instanceof Prisma.PrismaClientKnownRequestError
  ) {
    if (err.code === "P2002") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage = "Duplicate key error";
    }

    else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      errorMessage =
        "Foreign key constraint failed";
    }

    else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      errorMessage =
        "The requested record was not found";
    }
  }

  // --------------------------------
  // Prisma Initialization Error
  // --------------------------------

  else if (
    err instanceof Prisma.PrismaClientInitializationError
  ) {
    if (err.errorCode === "P1000") {
      statusCode = httpStatus.UNAUTHORIZED;

      errorMessage =
        "Authentication failed against database server. Please check your credentials";
    }

    else if (err.errorCode === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;

      errorMessage =
        "Can't reach database server";
    }
  }

  // --------------------------------
  // Prisma Unknown Request Error
  // --------------------------------

  else if (
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;

    errorMessage =
      "Error occurred during query execution";
  }

  // --------------------------------
  // Normal JavaScript Error
  // --------------------------------

  else if (err instanceof Error) {
    errorMessage = err.message;
  }

  // --------------------------------
  // Winston Logger
  // --------------------------------

  logger.error({
    message: errorMessage,
    name: errorName,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    stack: err.stack,
  });

  // --------------------------------
  // Response
  // --------------------------------

  res.status(statusCode).json({
    success: false,

    statusCode,

    name:
      config.node_env === "development"
        ? errorName
        : "Internal Server Error",

    message:
      config.node_env === "development"
        ? errorMessage
        : "Internal Server Error",

    error:
      config.node_env === "development"
        ? err
        : undefined,

    stack:
      config.node_env === "development"
        ? err.stack
        : undefined,
  });
};