import mongoose, { Schema, Document, Types } from "mongoose";

export interface ISurvey {
  idKoneksiData: Types.ObjectId;
  koordinat?: {
    longitude: number;
    latitude: number;
  } | null;
  urlJaringan?: string | null;
  diameterPipa?: number | null;
  urlPosisiBak?: string | null;
  posisiMeteran?: string | null;
  jumlahPenghuni?: number | null;
  standar?: boolean | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISurveyDocument extends ISurvey, Document {}

const surveySchema = new Schema<ISurveyDocument>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: "KoneksiData",
      required: [true, "ID koneksi data diperlukan"],
    },

    koordinat: {
      type: new Schema(
        {
          longitude: {
            type: Number,
            required: [true, "Longitude diperlukan"],
            min: [-180, "Longitude minimal -180"],
            max: [180, "Longitude maksimal 180"],
          },
          latitude: {
            type: Number,
            required: [true, "Latitude diperlukan"],
            min: [-90, "Latitude minimal -90"],
            max: [90, "Latitude maksimal 90"],
          },
        },
        { _id: false },
      ),
      default: null,
    },

    urlJaringan: {
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
        message: "URL jaringan tidak valid",
      },
    },

    diameterPipa: {
      type: Number,
      default: null,
      min: [0, "Diameter pipa tidak boleh negatif"],
    },

    urlPosisiBak: {
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
        message: "URL posisi bak tidak valid",
      },
    },

    posisiMeteran: {
      type: String,
      trim: true,
      default: null,
    },

    jumlahPenghuni: {
      type: Number,
      default: null,
      min: [1, "Jumlah penghuni minimal 1"],
      validate: {
        validator: function (value: number | null) {
          if (value === null || value === undefined) return true;
          return Number.isInteger(value);
        },
        message: "Jumlah penghuni harus bilangan bulat",
      },
    },

    standar: {
      type: Boolean,
      default: null,
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

export const Survey = mongoose.model<ISurveyDocument>("Survei", surveySchema);
