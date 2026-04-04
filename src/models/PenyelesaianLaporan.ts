import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPenyelesaianLaporan {
  idLaporan: Types.ObjectId;
  urlGambar?: string[] | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPenyelesaianLaporanDocument
  extends IPenyelesaianLaporan, Document {}

const penyelesaianLaporanSchema = new Schema<IPenyelesaianLaporanDocument>(
  {
    idLaporan: {
      type: Schema.Types.ObjectId,
      ref: "Laporan",
      required: [true, "ID laporan diperlukan"],
    },

    urlGambar: {
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
        message: "Salah satu URL gambar tidak valid",
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

export const PenyelesaianLaporan = mongoose.model<IPenyelesaianLaporanDocument>(
  "PenyelesaianLaporan",
  penyelesaianLaporanSchema,
);
