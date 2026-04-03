import { GraphQLContext } from "../../types";
import { handleError } from "../../utils/errors";
import services from "../../services";
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../../services/authService";

interface LoginArgs {
  input: LoginInput;
}

interface RegisterArgs {
  input: RegisterInput;
}

interface RefreshTokenArgs {
  refreshToken: string;
}

interface ChangePasswordArgs {
  input: ChangePasswordInput;
}

interface ForgotPasswordArgs {
  input: {
    email: string;
  };
}

interface ResetPasswordArgs {
  input: ResetPasswordInput;
}

const authResolver = {
  Query: {
    me: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        if (!context.user) {
          return null;
        }
        return await services.authService.getCurrentUser(
          context.user._id.toString(),
        );
      } catch (error) {
        throw handleError(error, "Resolver.me");
      }
    },
  },

  Mutation: {
    login: async (_: unknown, args: LoginArgs) => {
      try {
        const { user, tokens } = await services.authService.login(args.input);
        return { user, tokens };
      } catch (error) {
        throw handleError(error, "Resolver.login");
      }
    },

    register: async (_: unknown, args: RegisterArgs) => {
      try {
        const { user, tokens } = await services.authService.register(
          args.input,
        );
        return { user, tokens };
      } catch (error) {
        throw handleError(error, "Resolver.register");
      }
    },

    refreshToken: async (_: unknown, args: RefreshTokenArgs) => {
      try {
        return await services.authService.refreshTokens(args.refreshToken);
      } catch (error) {
        throw handleError(error, "Resolver.refreshToken");
      }
    },

    logout: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        if (!context.user) {
          throw new Error("User not found in context");
        }
        await services.authService.logout(context.user._id.toString());
        return {
          success: true,
          message: "Logged out successfully",
        };
      } catch (error) {
        throw handleError(error, "Resolver.logout");
      }
    },

    changePassword: async (
      _: unknown,
      args: ChangePasswordArgs,
      context: GraphQLContext,
    ) => {
      try {
        if (!context.user) {
          throw new Error("User not found in context");
        }
        await services.authService.changePassword(
          context.user._id.toString(),
          args.input,
        );
        return {
          success: true,
          message: "Password changed successfully",
        };
      } catch (error) {
        throw handleError(error, "Resolver.changePassword");
      }
    },

    forgotPassword: async (_: unknown, args: ForgotPasswordArgs) => {
      try {
        await services.authService.forgotPassword(args.input.email);
        return {
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        };
      } catch (error) {
        throw handleError(error, "Resolver.forgotPassword");
      }
    },

    resetPassword: async (_: unknown, args: ResetPasswordArgs) => {
      try {
        await services.authService.resetPassword(args.input);
        return {
          success: true,
          message:
            "Password has been reset successfully. You can now sign in with your new password.",
        };
      } catch (error) {
        throw handleError(error, "Resolver.resetPassword");
      }
    },
  },

  User: {
    id: (parent: { _id: { toString(): string } }) => {
      return parent._id.toString();
    },
    pekerjaanSekarang: (parent: { pekerjaanSekarang?: any }) => {
      if (!parent.pekerjaanSekarang) return null;
      return parent.pekerjaanSekarang.toString();
    },
  },
};

export default authResolver;
