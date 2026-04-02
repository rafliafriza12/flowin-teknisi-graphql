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
    // Any authenticated role
    me: ["Technician"],

    // Technician or Admin
    user: ["Admin", "Technician"],

    // Admin only
    users: ["Admin"],
    usersByRole: ["Admin"],
  },

  Mutation: {
    // Public — no login required
    login: "public",
    refreshToken: "public",
    forgotPassword: "public",
    resetPassword: "public",

    // Any authenticated role
    logout: ["Admin", "Technician", "User"],
    changePassword: ["Admin", "Technician", "User"],

    // Technician or Admin
    updateUser: ["Admin", "Technician"],

    // Admin only
    register: ["Admin"],
    createUser: ["Admin"],
    deleteUser: ["Admin"],
    toggleUserStatus: ["Admin"],
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
