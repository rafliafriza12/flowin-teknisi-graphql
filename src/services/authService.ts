import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { User, IUserDocument } from "../models";
import { config } from "../config";
import { JwtPayload } from "../types";
import {
  authenticationError,
  notFoundError,
  validationError,
  forbiddenError,
  handleError,
} from "../utils/errors";
import emailService from "./emailService";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  namaLengkap: string;
  nip: string;
  email: string;
  noHp: string;
  divisi: "perencanaan_teknik" | "teknik_cabang" | "pengawasan_teknik";
  password: string;
}

export interface ChangePasswordInput {
  oldPassword: string;
  newPassword: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: IUserDocument;
  tokens: TokenPair;
}

const authService = {
  generateAccessToken: (user: IUserDocument): string => {
    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: "Technician",
      type: "access",
    };

    return jwt.sign(payload, config.jwt.accessTokenSecret, {
      expiresIn: config.jwt.accessTokenExpiresIn as string,
    } as jwt.SignOptions);
  },

  generateRefreshToken: (user: IUserDocument): string => {
    const payload: JwtPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: "Technician",
      type: "refresh",
    };

    return jwt.sign(payload, config.jwt.refreshTokenSecret, {
      expiresIn: config.jwt.refreshTokenExpiresIn as string,
    } as jwt.SignOptions);
  },

  generateTokens: (user: IUserDocument): TokenPair => {
    return {
      accessToken: authService.generateAccessToken(user),
      refreshToken: authService.generateRefreshToken(user),
    };
  },

  verifyAccessToken: (token: string): JwtPayload => {
    try {
      const decoded = jwt.verify(
        token,
        config.jwt.accessTokenSecret,
      ) as JwtPayload;

      if (decoded.type !== "access") {
        throw authenticationError("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw authenticationError("Access token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw authenticationError("Invalid access token");
      }
      throw handleError(error, "AuthService.verifyAccessToken");
    }
  },

  verifyRefreshToken: (token: string): JwtPayload => {
    try {
      const decoded = jwt.verify(
        token,
        config.jwt.refreshTokenSecret,
      ) as JwtPayload;

      if (decoded.type !== "refresh") {
        throw authenticationError("Invalid token type");
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw authenticationError("Refresh token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw authenticationError("Invalid refresh token");
      }
      throw handleError(error, "AuthService.verifyRefreshToken");
    }
  },

  login: async (input: LoginInput): Promise<AuthResponse> => {
    try {
      const { email, password } = input;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw authenticationError("Invalid email or password");
      }

      if (!user.isActive) {
        throw forbiddenError("Account is not active. Please contact admin.");
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw authenticationError("Invalid email or password");
      }

      const tokens = authService.generateTokens(user);

      user.accessToken = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return { user, tokens };
    } catch (error) {
      throw handleError(error, "AuthService.login");
    }
  },

  register: async (input: RegisterInput): Promise<AuthResponse> => {
    try {
      const existingEmail = await User.findOne({
        email: input.email.toLowerCase(),
      });
      if (existingEmail) {
        throw validationError("Email ini sudah digunakan oleh teknisi lain");
      }

      const existingNIP = await User.findOne({
        nip: input.nip.trim(),
      });
      if (existingNIP) {
        throw validationError("NIP ini sudah digunakan oleh teknisi lain");
      }

      const existingNohp = await User.findOne({
        noHp: input.noHp.trim(),
      });
      if (existingNohp) {
        throw validationError("No HP ini sudah digunakan oleh teknisi lain");
      }

      const user = new User({
        ...input,
      });

      await user.save();

      const tokens = authService.generateTokens(user);

      user.accessToken = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return { user, tokens };
    } catch (error) {
      throw handleError(error, "AuthService.register");
    }
  },

  refreshTokens: async (refreshToken: string): Promise<TokenPair> => {
    try {
      const decoded = authService.verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw authenticationError("User not found");
      }

      if (user.refreshToken !== refreshToken) {
        throw authenticationError("Invalid refresh token");
      }

      if (!user.isActive) {
        throw forbiddenError("Account is not active");
      }

      const tokens = authService.generateTokens(user);

      user.accessToken = tokens.accessToken;
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch (error) {
      throw handleError(error, "AuthService.refreshTokens");
    }
  },

  logout: async (userId: string): Promise<boolean> => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw notFoundError("User not found", "User");
      }

      user.accessToken = undefined;
      user.refreshToken = undefined;
      await user.save();

      return true;
    } catch (error) {
      throw handleError(error, "AuthService.logout");
    }
  },

  getCurrentUser: async (userId: string): Promise<IUserDocument> => {
    try {
      const user = await User.findById(userId).select(
        "-password -accessToken -refreshToken",
      );
      if (!user) {
        throw notFoundError("User not found", "User");
      }
      return user;
    } catch (error) {
      throw handleError(error, "AuthService.getCurrentUser");
    }
  },

  changePassword: async (
    userId: string,
    input: ChangePasswordInput,
  ): Promise<boolean> => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw notFoundError("User not found", "User");
      }

      const isPasswordValid = await bcrypt.compare(
        input.oldPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw validationError("Current password is incorrect", {
          oldPassword: "Current password is incorrect",
        });
      }

      user.password = input.newPassword;
      await user.save();

      return true;
    } catch (error) {
      throw handleError(error, "AuthService.changePassword");
    }
  },

  forgotPassword: async (email: string): Promise<boolean> => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });

      // Always return true for security — don't reveal if email exists
      if (!user || !user.isActive) {
        return true;
      }

      // Generate a secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Hash the token before storing (so even if DB is compromised, raw tokens are safe)
      const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Store hashed token and expiry (1 hour)
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      // Send email with the raw (unhashed) token
      await emailService.sendPasswordResetEmail(
        user.email,
        user.namaLengkap,
        resetToken,
      );

      return true;
    } catch (error) {
      throw handleError(error, "AuthService.forgotPassword");
    }
  },

  resetPassword: async (input: ResetPasswordInput): Promise<boolean> => {
    try {
      // Hash the incoming token to compare with stored hash
      const hashedToken = crypto
        .createHash("sha256")
        .update(input.token)
        .digest("hex");

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() },
      });

      if (!user) {
        throw validationError("Password reset token is invalid or has expired");
      }

      // Set the new password (pre-save hook will hash it)
      user.password = input.newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      // Invalidate existing sessions
      user.accessToken = undefined;
      user.refreshToken = undefined;
      await user.save();

      return true;
    } catch (error) {
      throw handleError(error, "AuthService.resetPassword");
    }
  },
};

export default authService;
