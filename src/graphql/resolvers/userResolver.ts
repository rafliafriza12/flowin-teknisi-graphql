import { ByIdInput } from "../../types";
import { handleError } from "../../utils/errors";
import services from "../../services";
import { CreateUserInput, UpdateUserInput } from "../../services/userService";

interface GetByRoleArgs {
  role: string;
}

interface CreateUserArgs {
  input: {
    profilePictureUrl: string;
    fullname: string;
    username: string;
    email: string;
    password: string;
    role: string;
  };
}

interface UpdateUserArgs {
  id: string;
  input: {
    profilePictureUrl?: string;
    fullname?: string;
    username?: string;
    email?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  };
}

const userResolver = {
  Query: {
    users: async () => {
      try {
        return await services.userService.getAllUsers();
      } catch (error) {
        throw handleError(error, "Resolver.users");
      }
    },

    user: async (_: unknown, args: ByIdInput) => {
      try {
        return await services.userService.getUserById(args.id);
      } catch (error) {
        throw handleError(error, "Resolver.user");
      }
    },

    usersByRole: async (_: unknown, args: GetByRoleArgs) => {
      try {
        const role = args.role.replace(/_/g, " ") as "Super Admin" | "Admin" | "Copywriter";
        return await services.userService.getUsersByRole(role);
      } catch (error) {
        throw handleError(error, "Resolver.usersByRole");
      }
    },
  },

  Mutation: {
    createUser: async (_: unknown, args: CreateUserArgs) => {
      try {
        const input: CreateUserInput = {
          ...args.input,
          role: args.input.role.replace(/_/g, " ") as "Super Admin" | "Admin" | "Copywriter"
        };
        return await services.userService.createUser(input);
      } catch (error) {
        throw handleError(error, "Resolver.createUser");
      }
    },

    updateUser: async (_: unknown, args: UpdateUserArgs) => {
      try {
        let input: UpdateUserInput;
        
        if (args.input.role) {
          input = {
            ...args.input,
            role: args.input.role.replace(/_/g, " ") as "Super Admin" | "Admin" | "Copywriter"
          };
        } else {
          const { role, ...rest } = args.input;
          input = rest;
        }
        
        return await services.userService.updateUser(args.id, input);
      } catch (error) {
        throw handleError(error, "Resolver.updateUser");
      }
    },

    deleteUser: async (_: unknown, args: ByIdInput) => {
      try {
        await services.userService.deleteUser(args.id);
        return {
          success: true,
          message: "User deleted successfully",
        };
      } catch (error) {
        throw handleError(error, "Resolver.deleteUser");
      }
    },

    toggleUserStatus: async (_: unknown, args: ByIdInput) => {
      try {
        const user = await services.userService.toggleUserStatus(args.id);
        return {
          success: true,
          message: `User ${user.isActive ? "activated" : "deactivated"} successfully`,
          user,
        };
      } catch (error) {
        throw handleError(error, "Resolver.toggleUserStatus");
      }
    },
  },

  User: {
    id: (parent: { _id: { toString(): string } }) => {
      return parent._id.toString();
    },
    // Role is returned as-is from database (no transformation)
  },
};

export default userResolver;
