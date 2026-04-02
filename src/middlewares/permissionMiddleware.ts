import { GraphQLContext } from "../types";
import { IUserDocument, RoleName } from "../models";
import { authenticationError, forbiddenError } from "../utils/errors";
import { getPermission, PermissionType } from "./permissions";

type ResolverFunction = (
  parent: unknown,
  args: unknown,
  context: GraphQLContext,
  info: unknown,
) => unknown;

type ResolverMap = Record<string, ResolverFunction>;

interface Resolvers {
  Query?: ResolverMap;
  Mutation?: ResolverMap;
  [key: string]: unknown;
}

// ─── Role middleware (guard) functions ─────────────────────────────────────────
// Setiap middleware bertugas memvalidasi context untuk role tertentu.
// Kamu bisa tambahkan logic database validation di sini nanti.

/**
 * Middleware: validasi bahwa context memiliki role "Admin".
 * Tambahkan logic DB validation di sini sesuai kebutuhan.
 */
export const isAdmin = async (context: GraphQLContext): Promise<void> => {
  if (!context.user || !context.role) {
    throw authenticationError("Authentication required. Please login.");
  }
  if (context.role !== "Admin") {
    throw forbiddenError("Access denied.");
  }
};

/**
 * Middleware: validasi bahwa context memiliki role "Technician".
 * Tambahkan logic DB validation di sini sesuai kebutuhan.
 */
export const isTechnician = async (context: GraphQLContext): Promise<void> => {
  if (!context.user || !context.role) {
    throw authenticationError("Authentication required. Please login.");
  }
  if (context.role !== "Technician") {
    throw forbiddenError("Access denied.");
  }
};

/**
 * Middleware: validasi bahwa context memiliki role "User".
 * Tambahkan logic DB validation di sini sesuai kebutuhan.
 */
export const isUser = async (context: GraphQLContext): Promise<void> => {
  if (!context.user || !context.role) {
    throw authenticationError("Authentication required. Please login.");
  }
  if (context.role !== "User") {
    throw forbiddenError("Access denied.");
  }
};

/**
 * Middleware: validasi bahwa user sudah login (role apapun).
 * Tambahkan logic DB validation di sini sesuai kebutuhan.
 */
export const requireAuth = async (context: GraphQLContext): Promise<void> => {
  if (!context.user || !context.role) {
    throw authenticationError("Authentication required. Please login.");
  }
};

// ─── Mapping: RoleName → middleware function ──────────────────────────────────

const roleMiddlewareMap: Record<
  RoleName,
  (context: GraphQLContext) => Promise<void>
> = {
  Admin: isAdmin,
  Technician: isTechnician,
  User: isUser,
};

// ─── Core permission check ────────────────────────────────────────────────────

/**
 * Inti pengecekan permission — dipanggil otomatis oleh wrapResolver.
 *
 * Alur:
 * 1. "public"     → langsung lolos, tidak butuh login
 * 2. RoleName[]   → harus login, lalu panggil middleware yang sesuai
 *                    berdasarkan role user dari JWT.
 *
 * checkPermission akan memanggil isAdmin() / isTechnician() / isUser()
 * secara otomatis. Di middleware itulah kamu bisa taruh validasi DB.
 */
export const checkPermission = async (
  context: GraphQLContext,
  permission: PermissionType,
): Promise<IUserDocument | null> => {
  // Public route — tidak butuh login
  if (permission === "public") {
    return context.user ?? null;
  }

  // Harus login
  if (!context.user || !context.role) {
    throw authenticationError("Authentication required. Please login.");
  }

  // Cek apakah role user ada di daftar role yang diizinkan
  if (!permission.includes(context.role)) {
    throw forbiddenError(`Access denied.`);
  }

  //  Panggil middleware sesuai role user untuk validasi lebih lanjut (DB, dll)
  const middleware = roleMiddlewareMap[context.role];
  if (middleware) {
    await middleware(context);
  }

  return context.user;
};

// ─── Utility helpers (tanpa throw, untuk conditional logic di resolver) ───────

/** Cek role tanpa throw — untuk conditional logic di dalam resolver. */
export const hasRole = (context: GraphQLContext, role: RoleName): boolean => {
  return context.role === role;
};

/** Cek apakah role ada di list — untuk conditional logic. */
export const hasAnyRole = (
  context: GraphQLContext,
  roles: RoleName[],
): boolean => {
  return !!context.role && roles.includes(context.role);
};

// ─── Resolver wrapper ─────────────────────────────────────────────────────────

const wrapResolver = (
  resolver: ResolverFunction,
  type: "Query" | "Mutation",
  operationName: string,
): ResolverFunction => {
  return async (parent, args, context, info) => {
    const permission = getPermission(type, operationName);
    await checkPermission(context, permission);
    return resolver(parent, args, context, info);
  };
};

const wrapResolverMap = (
  resolvers: ResolverMap | undefined,
  type: "Query" | "Mutation",
): ResolverMap => {
  if (!resolvers) return {};
  const wrapped: ResolverMap = {};
  for (const [operationName, resolver] of Object.entries(resolvers)) {
    wrapped[operationName] = wrapResolver(resolver, type, operationName);
  }
  return wrapped;
};

/**
 * Wrap semua resolver dengan pengecekan permission otomatis
 * berdasarkan mapping di `permissions.ts`.
 */
export const withPermissions = (resolvers: Resolvers): Resolvers => {
  const result: Resolvers = { ...resolvers };
  if (resolvers.Query) result.Query = wrapResolverMap(resolvers.Query, "Query");
  if (resolvers.Mutation)
    result.Mutation = wrapResolverMap(resolvers.Mutation, "Mutation");
  return result;
};

/** No-op — kept for backward compatibility. */
export const clearRolePermissionsCache = (_roleName?: string): void => {};
