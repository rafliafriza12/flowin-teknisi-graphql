import { GraphQLContext } from "../../types";
import { handleError } from "../../utils/errors";
import services from "../../services";

interface LoginArgs {
  input: {
    email: string;
    password: string;
  };
}

interface RegisterArgs {
  input: {
    profilePictureUrl: string;
    fullname: string;
    username: string;
    email: string;
    password: string;
    role: string;
  };
}

interface RefreshTokenArgs {
  refreshToken: string;
}

interface ChangePasswordArgs {
  input: {
    oldPassword: string;
    newPassword: string;
  };
}

interface ForgotPasswordArgs {
  input: {
    email: string;
  };
}

interface ResetPasswordArgs {
  input: {
    token: string;
    newPassword: string;
  };
}

interface AddRoleArgs {
  role: string;
}

interface RemoveRoleArgs {
  role: string;
}

const authResolver = {
  Query: {
    me: async (_: unknown, __: unknown, context: GraphQLContext) => {
      try {
        if (!context.user) {
          return null;
        }
        return await services.authService.getCurrentUser(context.user._id.toString());
      } catch (error) {
        throw handleError(error, "Resolver.me");
      }
    },

    userSettings: async () => {
      try {
        return await services.userService.getSettings();
      } catch (error) {
        throw handleError(error, "Resolver.userSettings");
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
        const input = {
          ...args.input,
        };
        const { user, tokens } = await services.authService.register(input);
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
      context: GraphQLContext
    ) => {
      try {
        if (!context.user) {
          throw new Error("User not found in context");
        }
        await services.authService.changePassword(
          context.user._id.toString(),
          args.input.oldPassword,
          args.input.newPassword
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
          message: "If an account with that email exists, a password reset link has been sent.",
        };
      } catch (error) {
        throw handleError(error, "Resolver.forgotPassword");
      }
    },

    resetPassword: async (_: unknown, args: ResetPasswordArgs) => {
      try {
        await services.authService.resetPassword(
          args.input.token,
          args.input.newPassword
        );
        return {
          success: true,
          message: "Password has been reset successfully. You can now sign in with your new password.",
        };
      } catch (error) {
        throw handleError(error, "Resolver.resetPassword");
      }
    },

    addUserRole: async (_: unknown, args: AddRoleArgs) => {
      try {
        return await services.userService.addRole(args.role);
      } catch (error) {
        throw handleError(error, "Resolver.addUserRole");
      }
    },

    removeUserRole: async (_: unknown, args: RemoveRoleArgs) => {
      try {
        return await services.userService.removeRole(args.role);
      } catch (error) {
        throw handleError(error, "Resolver.removeUserRole");
      }
    },
  },

  User: {
    id: (parent: { _id: { toString(): string } }) => {
      return parent._id.toString();
    },
  },

  UserSettings: {
    id: (parent: { _id: { toString(): string } }) => {
      return parent._id.toString();
    },
  },
};

export default authResolver;
