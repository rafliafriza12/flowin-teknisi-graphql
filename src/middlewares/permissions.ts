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

    // Work Order Typedef
    workOrders: ["admin"],
    workOrder: ["admin", "Technician"],
    workOrdersSaya: ["Technician"],
    workOrdersByKoneksiData: ["admin", "Technician"],
    workflowChain: ["admin", "Technician"],
    cekPrerequisitePekerjaan: ["admin"],

    // Work Order Typedef — Teknisi
    progresWorkOrder: ["admin", "Technician"],
    paymentLinkRAB: ["admin", "Technician"],
    laporan: ["admin", "Technician"],
    dashboardStats: ["Technician"],
  },

  Mutation: {
    // Auth Typedef
    login: "public",
    refreshToken: "public",
    forgotPassword: "public",
    resetPassword: "public",
    logout: ["Technician"],
    changePassword: ["admin", "Technician"],
    register: ["admin"],

    // User Typedef
    updateUser: ["admin"],
    deleteUser: ["admin"],
    toggleUserStatus: ["admin"],

    // Work Order Typedef — admin
    buatWorkOrder: ["admin"],
    reviewTim: ["admin"],
    reviewHasil: ["admin"],
    reviewPenolakan: ["admin"],
    batalkanWorkOrder: ["admin"],

    // Work Order Typedef — Teknisi
    terimaPekerjaan: ["Technician"],
    ajukanPenolakan: ["Technician"],
    ajukanTim: ["Technician"],
    kerjaSendiri: ["Technician"],
    simpanProgres: ["Technician"],
    kirimHasil: ["Technician"],
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
  return permissions[type]?.[operation] ?? ["admin", "Technician", "User"];
};
