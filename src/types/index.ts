import { Request, Response } from "express";
import { IUserDocument } from "../models";

// UserRole is now dynamic (stored in database), so we use string type
export type UserRole = string;

// Localized string type for multi-language support
export interface ILocalizedString {
  en: string;
  id: string;
}

// Helper type for optional localized fields
export interface ILocalizedStringOptional {
  en?: string;
  id?: string;
}

export type PermissionLevel = "public" | "authenticated" | string[];

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  type: "access" | "refresh";
}

export interface GraphQLContext {
  req: Request;
  res: Response;
  user?: IUserDocument | null;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ByIdInput {
  id: string;
}
