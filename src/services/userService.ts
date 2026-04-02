import { User, IUserDocument, UserSettings, IUserSettingsDocument } from "../models";
import { notFoundError, conflictError, handleError, validateId } from "../utils/errors";

export interface CreateUserInput {
  profilePictureUrl: string;
  fullname: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

export interface UpdateUserInput {
  profilePictureUrl?: string;
  fullname?: string;
  username?: string;
  email?: string;
  role?: string;
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
        "-password -accessToken -refreshToken"
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
        "-password -accessToken -refreshToken"
      );
      return savedUser!;
    } catch (error) {
      throw handleError(error, "UserService.create");
    }
  },

  updateUser: async (id: string, input: UpdateUserInput): Promise<IUserDocument> => {
    validateId(id);

    try {
      if (input.email) {
        const existingEmail = await User.findOne({
          email: input.email.toLowerCase(),
          _id: { $ne: id },
        });
        if (existingEmail) {
          throw conflictError("Email already registered by another user", "email");
        }
      }

      if (input.username) {
        const existingUsername = await User.findOne({
          username: input.username.toLowerCase(),
          _id: { $ne: id },
        });
        if (existingUsername) {
          throw conflictError("Username already taken by another user", "username");
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
        "-password -accessToken -refreshToken"
      );
      return updatedUser!;
    } catch (error) {
      throw handleError(error, "UserService.toggleStatus");
    }
  },

  getUsersByRole: async (role: string): Promise<IUserDocument[]> => {
    try {
      return await User.find({ role })
        .select("-password -accessToken -refreshToken")
        .sort({ createdAt: -1 });
    } catch (error) {
      throw handleError(error, "UserService.getByRole");
    }
  },

  // Settings methods
  getSettings: async (): Promise<IUserSettingsDocument> => {
    try {
      let settings = await UserSettings.findOne();
      
      if (!settings) {
        settings = new UserSettings({
          roles: ["Super Admin", "Admin", "Copywriter"],
        });
        await settings.save();
      } else if (!settings.roles || settings.roles.length === 0) {
        // Handle case where settings exists but roles is empty
        settings.roles = ["Super Admin", "Admin", "Copywriter"];
        await settings.save();
      }
      
      return settings;
    } catch (error) {
      throw handleError(error, "UserService.getSettings");
    }
  },

  addRole: async (role: string): Promise<IUserSettingsDocument> => {
    try {
      let settings = await UserSettings.findOne();
      
      if (!settings) {
        settings = new UserSettings({
          roles: ["Super Admin", "Admin", "Copywriter", role],
        });
      } else {
        if (!settings.roles.includes(role)) {
          settings.roles.push(role);
        }
      }
      
      return await settings.save();
    } catch (error) {
      throw handleError(error, "UserService.addRole");
    }
  },

  removeRole: async (role: string): Promise<IUserSettingsDocument> => {
    try {
      const settings = await UserSettings.findOne();
      
      if (!settings) {
        throw notFoundError("UserSettings tidak ditemukan", "UserSettings");
      }
      
      settings.roles = settings.roles.filter((r) => r !== role);
      
      return await settings.save();
    } catch (error) {
      throw handleError(error, "UserService.removeRole");
    }
  },
};

export default userService;
