import { ByIdInput } from "../../types";
import { handleError } from "../../utils/errors";
import services from "../../services";
import { CreateUserInput, UpdateUserInput } from "../../services/userService";

interface CreateUserArgs {
  input: {
    profilePictureUrl: string;
    fullname: string;
    username: string;
    email: string;
    password: string;
  };
}

interface UpdateUserArgs {
  id: string;
  input: {
    profilePictureUrl?: string;
    fullname?: string;
    username?: string;
    email?: string;
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
  },

  Mutation: {
    createUser: async (_: unknown, args: CreateUserArgs) => {
      try {
        return await services.userService.createUser(args.input);
      } catch (error) {
        throw handleError(error, "Resolver.createUser");
      }
    },

    updateUser: async (_: unknown, args: UpdateUserArgs) => {
      try {
        return await services.userService.updateUser(args.id, args.input);
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
    id: (parent: { _id: { toString(): string } }) => parent._id.toString(),
  },
};

export default userResolver;
