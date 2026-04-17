import { Request } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, IUserDocument } from "../models";
import authService from "../services/authService";
import { JwtPayload, RoleName } from "../types";
import { config } from "../config";

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument | null;
      jwtPayload?: JwtPayload;
    }
  }
}

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers?.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
};

export interface AuthResult {
  user: IUserDocument | null;
  role: RoleName | null;
}

/**
 * Try to find admin from the `admins` collection (raw MongoDB query).
 * Admin JWT payload: { id, email, role, iat, exp } — no `type` field.
 */
const findAdminUser = async (
  adminId: string,
): Promise<IUserDocument | null> => {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;

    const admin = await db
      .collection("admins")
      .findOne({ _id: new mongoose.Types.ObjectId(adminId) });

    if (!admin) return null;

    // Map admin doc to IUserDocument-compatible shape
    return {
      _id: admin._id,
      namaLengkap: admin.namaLengkap,
      email: admin.email,
      nip: admin.NIP,
      noHp: admin.noHP,
      isActive: true,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    } as unknown as IUserDocument;
  } catch {
    return null;
  }
};

/**
 * Extracts user from JWT. Role is taken from the token payload directly —
 * it is NOT stored in the User document.
 *
 * Supports two token formats:
 * 1. Teknisi token: { userId, email, role, type: "access" }
 * 2. Admin PDAM token: { id, email, role } — no `type` field
 */
export const authMiddleware = async (req: Request): Promise<AuthResult> => {
  try {
    const token = extractToken(req);
    if (!token) return { user: null, role: null };

    // 1) Try teknisi token format first (has `type: "access"`)
    try {
      const decoded = authService.verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select("-password");
      if (user && user.isActive) {
        return { user, role: decoded.role };
      }
    } catch {
      // Not a teknisi token — fall through to admin check
    }

    // 2) Try admin PDAM token format: { id, email, role }
    try {
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret) as {
        id: string;
        email: string;
        role: string;
      };

      if (decoded.id && decoded.role) {
        const adminUser = await findAdminUser(decoded.id);
        if (adminUser) {
          return { user: adminUser, role: decoded.role as RoleName };
        }
      }
    } catch {
      // Invalid token entirely
    }

    return { user: null, role: null };
  } catch {
    return { user: null, role: null };
  }
};
