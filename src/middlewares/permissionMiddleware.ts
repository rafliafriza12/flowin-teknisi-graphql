import { GraphQLContext } from "../types";
import { IUserDocument, Role, IRolePermissions } from "../models";
import { authenticationError, forbiddenError } from "../utils/errors";
import { getPermission, PermissionType } from "./permissions";

type ResolverFunction = (
  parent: unknown,
  args: unknown,
  context: GraphQLContext,
  info: unknown
) => unknown;

type ResolverMap = Record<string, ResolverFunction>;

interface Resolvers {
  Query?: ResolverMap;
  Mutation?: ResolverMap;
  [key: string]: unknown;
}

// Cache for role permissions to avoid repeated database queries
const rolePermissionsCache = new Map<string, { permissions: IRolePermissions; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute cache TTL

/**
 * Get role permissions from cache or database
 */
const getRolePermissions = async (roleName: string): Promise<IRolePermissions | null> => {
  const now = Date.now();
  const cached = rolePermissionsCache.get(roleName);
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.permissions;
  }
  
  const role = await Role.findOne({ name: roleName });
  if (!role) {
    return null;
  }
  
  rolePermissionsCache.set(roleName, {
    permissions: role.permissions,
    timestamp: now,
  });
  
  return role.permissions;
};

/**
 * Check if a role is "Super Admin" (special system role with all permissions)
 */
const isSuperAdmin = (roleName: string): boolean => {
  return roleName === "Super Admin";
};

/**
 * Check if user has the required permission
 */
const checkPermission = async (
  context: GraphQLContext,
  permission: PermissionType,
  operationName: string
): Promise<IUserDocument | null> => {
  // Public endpoints - no authentication required
  if (permission === "public") {
    return context.user || null;
  }

  // All other permissions require authentication
  if (!context.user) {
    throw authenticationError("Authentication required. Please login.");
  }

  // Just authenticated - any logged in user
  if (permission === "authenticated") {
    return context.user;
  }

  const userRole = context.user.role;

  // Super Admin only - special case
  if (permission === "superAdminOnly") {
    if (!isSuperAdmin(userRole)) {
      throw forbiddenError(
        `Access denied. This operation requires Super Admin privileges.`
      );
    }
    return context.user;
  }

  // Super Admin has all permissions
  if (isSuperAdmin(userRole)) {
    return context.user;
  }

  // Get role permissions from database
  const rolePermissions = await getRolePermissions(userRole);
  
  if (!rolePermissions) {
    throw forbiddenError(
      `Access denied. Role "${userRole}" not found.`
    );
  }

  // Check if the permission key exists and is true
  const permissionKey = permission as keyof IRolePermissions;
  if (!rolePermissions[permissionKey]) {
    throw forbiddenError(
      `Access denied. You don't have "${permissionKey}" permission for this operation.`
    );
  }

  return context.user;
};

/**
 * Wrap a resolver with permission checking
 */
const wrapResolver = (
  resolver: ResolverFunction,
  type: "Query" | "Mutation",
  operationName: string
): ResolverFunction => {
  return async (parent, args, context, info) => {
    const permission = getPermission(type, operationName);
    await checkPermission(context, permission, operationName);
    return resolver(parent, args, context, info);
  };
};

/**
 * Wrap all resolvers in a map with permission checking
 */
const wrapResolverMap = (
  resolvers: ResolverMap | undefined,
  type: "Query" | "Mutation"
): ResolverMap => {
  if (!resolvers) return {};

  const wrapped: ResolverMap = {};

  for (const [operationName, resolver] of Object.entries(resolvers)) {
    wrapped[operationName] = wrapResolver(resolver, type, operationName);
  }

  return wrapped;
};

/**
 * Apply permission middleware to all resolvers
 */
export const withPermissions = (resolvers: Resolvers): Resolvers => {
  const result: Resolvers = { ...resolvers };

  if (resolvers.Query) {
    result.Query = wrapResolverMap(resolvers.Query, "Query");
  }

  if (resolvers.Mutation) {
    result.Mutation = wrapResolverMap(resolvers.Mutation, "Mutation");
  }

  return result;
};

/**
 * Clear the role permissions cache (call when roles are updated)
 */
export const clearRolePermissionsCache = (roleName?: string): void => {
  if (roleName) {
    rolePermissionsCache.delete(roleName);
  } else {
    rolePermissionsCache.clear();
  }
};
