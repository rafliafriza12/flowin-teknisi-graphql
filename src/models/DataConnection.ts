import mongoose, { Schema, Types, Document } from "mongoose";

export interface IKoneksiData extends Document {
  // Foreign Key reference to Pelanggan (User)
  IdPelanggan: Types.ObjectId;

  // Status pengajuan (PENDING / APPROVED / REJECTED)
  StatusPengajuan: "PENDING" | "APPROVED" | "REJECTED";

  // Alasan penolakan (diisi saat REJECTED)
  AlasanPenolakan?: string;

  // Tanggal verifikasi
  TanggalVerifikasi?: Date;

  // Dokumen identitas
  NIK: string;
  NIKUrl: string;

  // Dokumen Kartu Keluarga
  NoKK: string;
  KKUrl: string;

  // Dokumen IMB (Izin Mendirikan Bangunan)
  IMB: string;
  IMBUrl: string;

  // Data alamat
  Alamat: string;
  Kelurahan: string;
  Kecamatan: string;

  // Data bangunan
  LuasBangunan: number;
  createdAt: Date;
  updatedAt: Date;
}

const koneksiDataSchema = new Schema<IKoneksiData>(
  {
    // Foreign Key ke Pengguna
    IdPelanggan: {
      type: Schema.Types.ObjectId,
      ref: "Pengguna", // Reference ke Pengguna model
      required: [true, "ID Pelanggan is required"],
      index: true,
    },

    // Status pengajuan
    StatusPengajuan: {
      type: String,
      enum: {
        values: ["PENDING", "APPROVED", "REJECTED"],
      },
      required: true,
    },

    // Alasan penolakan (diisi saat REJECTED)
    AlasanPenolakan: {
      type: String,
      trim: true,
      default: null,
    },

    // Tanggal verifikasi
    TanggalVerifikasi: {
      type: Date,
      default: null,
    },

    // NIK (Nomor Induk Kependudukan)
    NIK: {
      type: String,
      required: [true, "NIK is required"],
      trim: true,
      minlength: [16, "NIK must be 16 characters"],
      maxlength: [16, "NIK must be 16 characters"],
      match: [/^\d{16}$/, "NIK must be 16 digits"],
      unique: true,
    },

    // URL file NIK (foto/scan KTP)
    NIKUrl: {
      type: String,
      required: [true, "NIK document URL is required"],
      trim: true,
    },

    // No KK (Nomor Kartu Keluarga)
    NoKK: {
      type: String,
      required: [true, "No KK is required"],
      trim: true,
      minlength: [16, "No KK must be 16 characters"],
      maxlength: [16, "No KK must be 16 characters"],
      match: [/^\d{16}$/, "No KK must be 16 digits"],
    },

    // URL file KK (foto/scan Kartu Keluarga)
    KKUrl: {
      type: String,
      required: [true, "KK document URL is required"],
      trim: true,
    },

    // IMB (Izin Mendirikan Bangunan)
    IMB: {
      type: String,
      required: [true, "IMB number is required"],
      trim: true,
      maxlength: [50, "IMB number cannot exceed 50 characters"],
    },

    // URL file IMB
    IMBUrl: {
      type: String,
      required: [true, "IMB document URL is required"],
      trim: true,
    },

    // Alamat lengkap
    Alamat: {
      type: String,
      required: [true, "Alamat is required"],
      trim: true,
      maxlength: [500, "Alamat cannot exceed 500 characters"],
    },

    // Kelurahan
    Kelurahan: {
      type: String,
      required: [true, "Kelurahan is required"],
      trim: true,
      maxlength: [100, "Kelurahan cannot exceed 100 characters"],
    },

    // Kecamatan
    Kecamatan: {
      type: String,
      required: [true, "Kecamatan is required"],
      trim: true,
      maxlength: [100, "Kecamatan cannot exceed 100 characters"],
    },

    // Luas bangunan (dalam meter persegi)
    LuasBangunan: {
      type: Number,
      required: [true, "Luas Bangunan is required"],
      min: [1, "Luas Bangunan must be at least 1 m²"],
      max: [10000, "Luas Bangunan cannot exceed 10000 m²"],
    },
  },
  {
    timestamps: true,
  },
);

export const DataConnection = mongoose.model<IKoneksiData>(
  "KoneksiData",
  koneksiDataSchema,
);
