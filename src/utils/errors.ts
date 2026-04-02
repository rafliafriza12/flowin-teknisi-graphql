import { GraphQLError } from "graphql";
import {
  isMongooseValidationError,
  isMongooseCastError,
  isDuplicateKeyError,
  getDuplicateField,
  ERROR_CODE_MAP,
} from "../middlewares/errorHandler";

const createError = (
  message: string,
  code: string,
  statusCode: number,
  details?: Record<string, unknown>
): GraphQLError => {
  return new GraphQLError(message, {
    extensions: {
      code,
      statusCode,
      ...(details && { details }),
    },
  });
};

export const notFoundError = (
  message: string = "Resource not found",
  resource?: string
): GraphQLError => {
  return createError(
    message,
    ERROR_CODE_MAP.NOT_FOUND.code,
    ERROR_CODE_MAP.NOT_FOUND.statusCode,
    resource ? { resource } : undefined
  );
};

export const validationError = (
  message: string = "Validation failed",
  fields?: Record<string, string>
): GraphQLError => {
  return createError(
    message,
    ERROR_CODE_MAP.GRAPHQL_VALIDATION_FAILED.code,
    ERROR_CODE_MAP.GRAPHQL_VALIDATION_FAILED.statusCode,
    fields ? { fields } : undefined
  );
};

export const badUserInputError = (
  message: string = "Invalid input",
  field?: string
): GraphQLError => {
  return createError(
    message,
    ERROR_CODE_MAP.BAD_USER_INPUT.code,
    ERROR_CODE_MAP.BAD_USER_INPUT.statusCode,
    field ? { field } : undefined
  );
};

export const authenticationError = (
  message: string = "Authentication required"
): GraphQLError => {
  return createError(message, ERROR_CODE_MAP.UNAUTHENTICATED.code, ERROR_CODE_MAP.UNAUTHENTICATED.statusCode);
};

export const forbiddenError = (
  message: string = "Access forbidden"
): GraphQLError => {
  return createError(message, ERROR_CODE_MAP.FORBIDDEN.code, ERROR_CODE_MAP.FORBIDDEN.statusCode);
};

export const conflictError = (
  message: string = "Resource already exists",
  field?: string
): GraphQLError => {
  return createError(
    message,
    ERROR_CODE_MAP.CONFLICT.code,
    ERROR_CODE_MAP.FORBIDDEN.statusCode,
    field ? { field } : undefined
  );
};

export const internalServerError = (
  message: string = "Internal server error"
): GraphQLError => {
  return createError(message, ERROR_CODE_MAP.INTERNAL_SERVER_ERROR.code, ERROR_CODE_MAP.INTERNAL_SERVER_ERROR.statusCode);
};

export const serviceUnavailableError = (
  message: string = "Service temporarily unavailable"
): GraphQLError => {
  return createError(message, ERROR_CODE_MAP.SERVICE_UNAVAILABLE.code, ERROR_CODE_MAP.SERVICE_UNAVAILABLE.statusCode);
};

export const databaseError = (
  message: string = "Database operation failed"
): GraphQLError => {
  return createError(message, ERROR_CODE_MAP.DATABASE_ERROR.code, ERROR_CODE_MAP.DATABASE_ERROR.statusCode);
};

export const handleError = (error: unknown, context?: string): GraphQLError => {
  if (error instanceof GraphQLError) {
    return error;
  }

  if (isMongooseCastError(error)) {
    return badUserInputError(`Format ${error.path} tidak valid: ${error.value}`, error.path);
  }

  if (isMongooseValidationError(error)) {
    const validationErrors = Object.values(error.errors).reduce(
      (acc, err) => {
        acc[err.path] = err.message;
        return acc;
      },
      {} as Record<string, string>
    );
    return validationError("Validasi gagal", validationErrors);
  }

  if (isDuplicateKeyError(error)) {
    const field = getDuplicateField(error as Error);
    return conflictError(`Data dengan ${field} tersebut sudah ada`, field);
  }

  if (error instanceof Error) {
    console.error(`[${context || "Error"}]:`, error.message);
    return internalServerError(error.message);
  }

  console.error(`[${context || "Unknown Error"}]:`, error);
  return internalServerError("Terjadi kesalahan yang tidak terduga");
};

export const isGraphQLError = (error: unknown): error is GraphQLError => {
  return error instanceof GraphQLError;
};

export const validateId = (id: string, fieldName: string = "id"): void => {
  const isValid = /^[0-9a-fA-F]{24}$/.test(id);
  if (!isValid) {
    throw badUserInputError(`Format ${fieldName} tidak valid`, fieldName);
  }
};
