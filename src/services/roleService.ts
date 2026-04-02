/**
 * RoleName — matches the `role` claim embedded in JWTs.
 * Role is NOT stored in MongoDB; it lives only in the token.
 */
export type RoleName = "Admin" | "Technician" | "User";

export const VALID_ROLES: RoleName[] = ["Admin", "Technician", "User"];

export default {};
