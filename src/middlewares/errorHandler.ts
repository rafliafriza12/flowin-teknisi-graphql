import { Request, Response, NextFunction } from "express";
import { GraphQLFormattedError, GraphQLError } from "graphql";
import { config } from "../config";
import mongoose from "mongoose";

interface FormattedErrorResponse extends GraphQLFormattedError {
  extensions: {
    code: string;
    statusCode: number;
    timestamp: string;
    path?: readonly (string | number)[];
    field?: string;
    details?: unknown;
    stacktrace?: string[];
  };
}

export const ERROR_CODE_MAP: Record<string, { code: string; statusCode: number }> = {
  GRAPHQL_PARSE_FAILED: { code: "GRAPHQL_PARSE_FAILED", statusCode: 400 },
  GRAPHQL_VALIDATION_FAILED: { code: "GRAPHQL_VALIDATION_FAILED", statusCode: 400 },
  BAD_USER_INPUT: { code: "BAD_USER_INPUT", statusCode: 400 },
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", statusCode: 400 },
  UNAUTHENTICATED: { code: "UNAUTHENTICATED", statusCode: 401 },
  FORBIDDEN: { code: "FORBIDDEN", statusCode: 403 },
  NOT_FOUND: { code: "NOT_FOUND", statusCode: 404 },
  CONFLICT: { code: "CONFLICT", statusCode: 409 },
  DATABASE_ERROR: { code: "DATABASE_ERROR", statusCode: 500 },
  SERVICE_UNAVAILABLE: { code: "SERVICE_UNAVAILABLE", statusCode: 503 },
  INTERNAL_SERVER_ERROR: { code: "INTERNAL_SERVER_ERROR", statusCode: 500 },
};


export const formatGraphQLError = (
  formattedError: GraphQLFormattedError
): FormattedErrorResponse => {
  if (config.nodeEnv === "development") {
    console.error("═".repeat(50));
    console.error("🔴 GraphQL Error:");
    console.error("Message:", formattedError.message);
    console.error("Extensions:", formattedError.extensions);
    console.error("═".repeat(50));
  }

  const originalCode = formattedError.extensions?.code as string;
  const errorInfo = ERROR_CODE_MAP[originalCode] || ERROR_CODE_MAP.INTERNAL_SERVER_ERROR;

  const statusCode = (formattedError.extensions?.statusCode as number) || errorInfo.statusCode;

  const details = formattedError.extensions?.details as Record<string, unknown> | undefined;
  const field = formattedError.extensions?.field as string | undefined;

  const message = 
    config.nodeEnv === "production" && originalCode === "INTERNAL_SERVER_ERROR"
      ? "Internal server error"
      : formattedError.message;

  const response: FormattedErrorResponse = {
    message,
    path: formattedError.path,
    extensions: {
      code: errorInfo.code,
      statusCode,
      timestamp: new Date().toISOString(),
      path: formattedError.path,
      ...(field ? { field } : {}),
      ...(details ? { details } : {}),
    },
  };

  if (config.nodeEnv === "development" && formattedError.extensions?.stacktrace) {
    response.extensions.stacktrace = formattedError.extensions.stacktrace as string[];
  }

  return response;
};

export const isMongooseValidationError = (error: unknown): error is mongoose.Error.ValidationError => {
  return error instanceof mongoose.Error.ValidationError;
};

export const isMongooseCastError = (error: unknown): error is mongoose.Error.CastError => {
  return error instanceof mongoose.Error.CastError;
};

export const isDuplicateKeyError = (error: unknown): boolean => {
  return error instanceof Error && "code" in error && (error as { code: number }).code === 11000;
};

export const getDuplicateField = (error: Error): string => {
  const keyValue = (error as { keyValue?: Record<string, unknown> }).keyValue;
  return keyValue ? Object.keys(keyValue)[0] : "unknown";
};

export const httpContextMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.headers) {
    req.headers["x-request-id"] = req.headers["x-request-id"] || generateRequestId();
  }
  next();
};

export const requestLoggerMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (config.nodeEnv === "development") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
};

const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
