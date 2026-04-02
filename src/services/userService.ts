import { User, IUserDocument } from "../models";
import {
  notFoundError,
  conflictError,
  handleError,
  validateId,
} from "../utils/errors";

export interface CreateUserInput {
  profilePictureUrl: string;
  fullname: string;
  username: string;
  email: string;
  password: string;
}

export interface UpdateUserInput {
  profilePictureUrl?: string;
  fullname?: string;
  username?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
}

const userService = {
  getAllUsers: async (): Promise<IUserDocument[]> => {
    try {
      return await User.find()
        .select("-password -accessToken -refreshToken")
        .sort({ createdAt: -1 });
    } catch (error) {
      throw handleError(error, "UserService.getAll");
    }
  },

  getUserById: async (id: string): Promise<IUserDocument> => {
    validateId(id);

    try {
      const user = await User.findById(id).select(
        "-password -accessToken -refreshToken",
      );
      if (!user) {
        throw notFoundError(`User dengan ID ${id} tidak ditemukan`, "User");
      }
      return user;
    } catch (error) {
      throw handleError(error, "UserService.getById");
    }
  },

  createUser: async (input: CreateUserInput): Promise<IUserDocument> => {
    try {
      const existingEmail = await User.findOne({
        email: input.email.toLowerCase(),
      });
      if (existingEmail) {
        throw conflictError("Email already registered", "email");
      }

      const existingUsername = await User.findOne({
        username: input.username.toLowerCase(),
      });
      if (existingUsername) {
        throw conflictError("Username already taken", "username");
      }

      const user = new User({
        ...input,
        isActive: true,
      });

      await user.save();

      const savedUser = await User.findById(user._id).select(
        "-password -accessToken -refreshToken",
      );
      return savedUser!;
    } catch (error) {
      throw handleError(error, "UserService.create");
    }
  },

  updateUser: async (
    id: string,
    input: UpdateUserInput,
  ): Promise<IUserDocument> => {
    validateId(id);

    try {
      if (input.email) {
        const existingEmail = await User.findOne({
          email: input.email.toLowerCase(),
          _id: { $ne: id },
        });
        if (existingEmail) {
          throw conflictError(
            "Email already registered by another user",
            "email",
          );
        }
      }

      if (input.username) {
        const existingUsername = await User.findOne({
          username: input.username.toLowerCase(),
          _id: { $ne: id },
        });
        if (existingUsername) {
          throw conflictError(
            "Username already taken by another user",
            "username",
          );
        }
      }

      const user = await User.findByIdAndUpdate(id, input, {
        new: true,
        runValidators: true,
      }).select("-password -accessToken -refreshToken");

      if (!user) {
        throw notFoundError(`User dengan ID ${id} tidak ditemukan`, "User");
      }

      return user;
    } catch (error) {
      throw handleError(error, "UserService.update");
    }
  },

  deleteUser: async (id: string): Promise<boolean> => {
    validateId(id);

    try {
      const result = await User.findByIdAndDelete(id);
      if (!result) {
        throw notFoundError(`User dengan ID ${id} tidak ditemukan`, "User");
      }
      return true;
    } catch (error) {
      throw handleError(error, "UserService.delete");
    }
  },

  toggleUserStatus: async (id: string): Promise<IUserDocument> => {
    validateId(id);

    try {
      const user = await User.findById(id);
      if (!user) {
        throw notFoundError(`User dengan ID ${id} tidak ditemukan`, "User");
      }

      user.isActive = !user.isActive;
      await user.save();

      const updatedUser = await User.findById(id).select(
        "-password -accessToken -refreshToken",
      );
      return updatedUser!;
    } catch (error) {
      throw handleError(error, "UserService.toggleStatus");
    }
  },
};

export default userService;
