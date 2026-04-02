import { IRolePermissions } from "../models";

/**
 * Permission types for GraphQL operations
 */
export type PermissionType =
  | "public" // No authentication required
  | "authenticated" // Any authenticated user
  | keyof IRolePermissions // Dynamic permission from role (readAllContent, writeAllContent, etc.)
  | "superAdminOnly"; // Only Super Admin (system role)

export interface RoutePermissions {
  Query: Record<string, PermissionType>;
  Mutation: Record<string, PermissionType>;
}

/**
 * Dynamic permission mapping for GraphQL operations
 * Maps each operation to the required permission flag from IRolePermissions
 */
export const permissions: RoutePermissions = {
  Query: {
    // Authentication
    me: "authenticated",

    // User Management - requires userManagement permission
    users: "userManagement",
    user: "userManagement",
    usersByRole: "userManagement",

    // Role Management - requires roleManagement permission
    roles: "authenticated", // All authenticated users can see roles list (for UI)
    role: "authenticated",
    roleByName: "authenticated",
  },

  Mutation: {
    // Authentication - public
    login: "public",
    refreshToken: "public",
    logout: "authenticated",
    changePassword: "authenticated",
    forgotPassword: "public",
    resetPassword: "public",

    // User Management - requires userManagement permission
    register: "public",
    createUser: "userManagement",
    updateUser: "public",
    deleteUser: "userManagement",
    toggleUserStatus: "userManagement",

    // Role Management - requires roleManagement permission
    createRole: "roleManagement",
    updateRole: "roleManagement",
    deleteRole: "roleManagement",
    initializeDefaultRoles: "superAdminOnly",
  },
};

/**
 * Get the permission type for a GraphQL operation
 */
export const getPermission = (
  type: "Query" | "Mutation",
  operation: string,
): PermissionType => {
  return permissions[type][operation] || "authenticated";
};
