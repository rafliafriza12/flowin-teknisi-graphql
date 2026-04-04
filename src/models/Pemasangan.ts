import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPemasangan {
  idKoneksiData: Types.ObjectId;
  seriMeteran?: string | null;
  fotoRumah?: string | null;
  fotoMeteran?: string | null;
  fotoMeteranDanRumah?: string | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPemasanganDocument extends IPemasangan, Document {}

const pemasanganSchema = new Schema<IPemasanganDocument>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: "KoneksiData",
      required: [true, "ID koneksi data diperlukan"],
    },

    seriMeteran: {
      type: String,
      trim: true,
      default: null,
    },

    fotoRumah: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (value: string | null) {
          if (value === null || value === undefined) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "URL foto rumah tidak valid",
      },
    },

    fotoMeteran: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (value: string | null) {
          if (value === null || value === undefined) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "URL foto meteran tidak valid",
      },
    },

    fotoMeteranDanRumah: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator: function (value: string | null) {
          if (value === null || value === undefined) return true;
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "URL foto meteran dan rumah tidak valid",
      },
    },

    catatan: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Pemasangan = mongoose.model<IPemasanganDocument>(
  "Pemasangan",
  pemasanganSchema,
);
