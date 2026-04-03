import { RoleName } from "../models";

/**
 * Permission types:
 * - "public"        : No authentication required
 * - RoleName[]      : Array of roles that are allowed (e.g. ["Admin", "Technician"])
 */
export type PermissionType = "public" | RoleName[];

export interface RoutePermissions {
  Query: Record<string, PermissionType>;
  Mutation: Record<string, PermissionType>;
}

/**
 * Permission mapping for every GraphQL operation.
 * Use an array of allowed roles, or "public" for unauthenticated access.
 */
export const permissions: RoutePermissions = {
  Query: {
    // Auth Typedef
    me: ["Technician"],

    // User Typedef
    user: "public",
    users: "public",
  },

  Mutation: {
    // Auth Typedef
    login: "public",
    refreshToken: "public",
    forgotPassword: "public",
    resetPassword: "public",
    logout: ["Technician"],
    changePassword: "public",
    register: "public",

    // User Typedef
    updateUser: "public",
    deleteUser: "public",
    toggleUserStatus: "public",
  },
};

/**
 * Get the permission type for a GraphQL operation.
 * Defaults to all authenticated roles if not explicitly mapped.
 */
export const getPermission = (
  type: "Query" | "Mutation",
  operation: string,
): PermissionType => {
  return permissions[type]?.[operation] ?? ["Admin", "Technician", "User"];
};
