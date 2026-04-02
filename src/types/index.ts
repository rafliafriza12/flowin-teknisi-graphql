import { Request, Response } from "express";
import { IUserDocument } from "../models";
import { RoleName } from "../models";

export type { RoleName };

export interface JwtPayload {
  userId: string;
  email: string;
  role: RoleName;
  type: "access" | "refresh";
}

/**
 * GraphQL context — user is populated from JWT by authMiddleware.
 * Note: IUserDocument does NOT have a role field; role lives in the JWT only.
 * The resolved role is stored separately here.
 */
export interface GraphQLContext {
  req: Request;
  res: Response;
  user?: IUserDocument | null;
  role?: RoleName | null;
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
