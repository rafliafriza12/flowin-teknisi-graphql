import { Request } from "express";
import { User, IUserDocument } from "../models";
import authService from "../services/authService";
import { JwtPayload } from "../types";

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

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

export const authMiddleware = async (
  req: Request
): Promise<IUserDocument | null> => {
  try {
    const token = extractToken(req);

    if (!token) {
      return null;
    }

    const decoded = authService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("-password");

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
};
