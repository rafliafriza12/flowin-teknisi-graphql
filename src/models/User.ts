import mongoose, {
  Schema,
  Document,
  CallbackWithoutResultAndOptionalError,
} from "mongoose";
import bcrypt from "bcrypt";

/**
 * IUser — fields exposed via GraphQL.
 * Role is NOT stored in MongoDB — it is embedded in the JWT only.
 */
export interface IUser {
  profilePictureUrl: string;
  fullname: string;
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  accessToken?: string;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastOnline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    profilePictureUrl: {
      type: String,
      required: [true, "Profile Picture is required"],
    },
    fullname: {
      type: String,
      required: [true, "Full Name is required"],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: [true, "This username was used by other user"],
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          const regex = /^(?![_.])(?!.*[_.]{2})[a-z0-9._]{3,20}(?<![_.])$/;

          return regex.test(value);
        },
        message:
          "Username must be 3–20 characters, lowercase, and contain only letters, numbers, dots, or underscores. Cannot start or end with dot/underscore or contain repeated symbols.",
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: [true, "This email was used by other user"],
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

          return regex.test(value);
        },
        message: "Email format is invalid",
      },
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    accessToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    lastOnline: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.pre<IUserDocument>("save", async function (this: IUserDocument) {
  if (!this.isModified("password")) return;

  const regex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

  if (!regex.test(this.password)) {
    throw new Error(
      "Password must be at least 8 characters long, contain 1 uppercase letter, and 1 special character.",
    );
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

export const User = mongoose.model<IUserDocument>("User", userSchema);
