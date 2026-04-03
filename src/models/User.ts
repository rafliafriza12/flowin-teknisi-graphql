import mongoose, {
  Schema,
  Document,
  CallbackWithoutResultAndOptionalError,
  Types,
} from "mongoose";
import bcrypt from "bcrypt";

/**
 * IUser — fields exposed via GraphQL.
 * Role is NOT stored in MongoDB — it is embedded in the JWT only.
 */
export interface IUser {
  namaLengkap: string;
  nip: string;
  email: string;
  noHp: string;
  pekerjaanSekarang?: Types.ObjectId | null;
  divisi: "perencanaan_teknik" | "teknik_cabang" | "pengawasan_teknik";
  password: string;
  isActive: boolean;
  accessToken?: string;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    namaLengkap: {
      type: String,
      required: [true, "Nama lengkap diperlukan"],
    },
    nip: {
      type: String,
      required: [true, "NIP diperlukan"],
      unique: [true, "NIP ini sudah digunakan teknisi lain"],
      trim: true,
      validate: {
        validator: function (value: string) {
          const regex = /^[0-9]+$/;

          return regex.test(value);
        },
        message: "NIP harus angka",
      },
    },
    email: {
      type: String,
      required: [true, "Email diperlukan"],
      unique: [true, "Email ini sudah digunakan teknisi lain"],
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

          return regex.test(value);
        },
        message: "Format Email tidak valid",
      },
    },
    noHp: {
      type: String,
      required: [true, "No Hp is required"],
      unique: [true, "This NIP was used by other user"],
      trim: true,
      validate: {
        validator: function (value: string) {
          const regex = /^[0-9]+$/;

          return regex.test(value);
        },
        message: "NIP must contain only numbers",
      },
    },
    pekerjaanSekarang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PekerjaanTeknisi",
      required: false,
      default: null,
    },
    divisi: {
      type: String,
      enum: {
        values: ["perencanaan_teknik", "teknik_cabang", "pengawasan_teknik"],
        message: "Divisi tidak valid",
      },
      required: [true, "Divisi wajib diisi"],
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

export const User = mongoose.model<IUserDocument>(
  "TeknisiPerumdam",
  userSchema,
);
