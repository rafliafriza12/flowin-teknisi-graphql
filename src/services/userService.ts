import { User, IUserDocument } from "../models";
import {
  notFoundError,
  conflictError,
  handleError,
  validateId,
} from "../utils/errors";

export interface UpdateUserInput {
  namaLengkap?: string;
  nip?: string;
  email?: string;
  noHp?: string;
  divisi?: "perencanaan_teknik" | "teknik_cabang" | "pengawasan_teknik";
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
            "Email ini sudah digunakan oleh teknisi lain",
            "email",
          );
        }
      }

      if (input.nip) {
        const existingNIP = await User.findOne({
          nip: input.nip.trim(),
          _id: { $ne: id },
        });
        if (existingNIP) {
          throw conflictError(
            "IP ini sudah digunakan oleh teknisi lain",
            "nip",
          );
        }
      }

      if (input.noHp) {
        const existingNohp = await User.findOne({
          noHp: input.noHp.trim(),
          _id: { $ne: id },
        });
        if (existingNohp) {
          throw conflictError(
            "No HP ini sudah digunakan oleh teknisi lain",
            "nip",
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
