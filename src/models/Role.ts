/**
 * Role schema telah dihapus.
 * Role ditentukan dari JWT payload (field `role`) yang di-generate saat login.
 * Nilai yang valid: "Admin" | "Technician" | "User"
 *
 * Tidak ada collection `roles` di MongoDB.
 */

export type RoleName = "Admin" | "Technician" | "User";
