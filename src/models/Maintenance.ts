import mongoose, { Schema, Document, Types } from "mongoose";

export type KondisiDaya = "menyala" | "mati";
export type KondisiKoneksi = "terkoneksi" | "tidak_terkoneksi";

export interface IMaintenance {
  idKoneksiData: Types.ObjectId;
  kondisiSebelumDaya?: KondisiDaya | null;
  kondisiSebelumKoneksi?: KondisiKoneksi | null;
  fotoSebelum?: string[] | null;
  kondisiSetelahDaya?: KondisiDaya | null;
  kondisiSetelahKoneksi?: KondisiKoneksi | null;
  fotoSetelah?: string[] | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaintenanceDocument extends IMaintenance, Document {}

const KONDISI_DAYA: KondisiDaya[] = ["menyala", "mati"];
const KONDISI_KONEKSI: KondisiKoneksi[] = ["terkoneksi", "tidak_terkoneksi"];

const maintenanceSchema = new Schema<IMaintenanceDocument>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: "KoneksiData",
      required: [true, "ID koneksi data diperlukan"],
      index: true,
    },

    kondisiSebelumDaya: {
      type: String,
      enum: {
        values: KONDISI_DAYA,
        message: "Kondisi daya tidak valid: {VALUE}",
      },
      default: null,
    },

    kondisiSebelumKoneksi: {
      type: String,
      enum: {
        values: KONDISI_KONEKSI,
        message: "Kondisi koneksi tidak valid: {VALUE}",
      },
      default: null,
    },

    fotoSebelum: {
      type: [String],
      default: null,
      validate: {
        validator: function (value: string[] | null) {
          if (value === null || value === undefined) return true;
          return value.every((url) => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });
        },
        message: "Salah satu URL foto sebelum tidak valid",
      },
    },

    kondisiSetelahDaya: {
      type: String,
      enum: {
        values: KONDISI_DAYA,
        message: "Kondisi daya tidak valid: {VALUE}",
      },
      default: null,
    },

    kondisiSetelahKoneksi: {
      type: String,
      enum: {
        values: KONDISI_KONEKSI,
        message: "Kondisi koneksi tidak valid: {VALUE}",
      },
      default: null,
    },

    fotoSetelah: {
      type: [String],
      default: null,
      validate: {
        validator: function (value: string[] | null) {
          if (value === null || value === undefined) return true;
          return value.every((url) => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });
        },
        message: "Salah satu URL foto setelah tidak valid",
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

export const Maintenance = mongoose.model<IMaintenanceDocument>(
  "Maintenance",
  maintenanceSchema,
);
