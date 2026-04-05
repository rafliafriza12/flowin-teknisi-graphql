import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPengawasanPemasangan {
  idPemasangan?: Types.ObjectId | null;
  urlGambar?: string[] | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPengawasanPemasanganDocument
  extends IPengawasanPemasangan, Document {}

const pengawasanPemasanganSchema = new Schema<IPengawasanPemasanganDocument>(
  {
    idPemasangan: {
      type: Schema.Types.ObjectId,
      ref: "Pemasangan",
      required: false,
      default: null,
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

export const PengawasanPemasangan =
  mongoose.model<IPengawasanPemasanganDocument>(
    "PengawasanPemasangan",
    pengawasanPemasanganSchema,
  );
