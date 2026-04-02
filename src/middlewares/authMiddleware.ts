import { Request } from "express";
import { User, IUserDocument } from "../models";
import authService from "../services/authService";
import { JwtPayload, RoleName } from "../types";

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
 * Extracts user from JWT. Role is taken from the token payload directly —
 * it is NOT stored in the User document.
 */
export const authMiddleware = async (req: Request): Promise<AuthResult> => {
  try {
    const token = extractToken(req);
    if (!token) return { user: null, role: null };

    const decoded = authService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) return { user: null, role: null };

    return { user, role: decoded.role };
  } catch {
    return { user: null, role: null };
  }
};
