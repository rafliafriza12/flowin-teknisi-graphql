import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Status pembayaran dari Midtrans payment gateway.
 * Nilai menggunakan huruf kecil sesuai konvensi Midtrans transaction_status.
 */
export type EnumPaymentStatus =
  | "pending"
  | "settlement"
  | "cancel"
  | "expire"
  | "refund"
  | "chargeback"
  | "fraud";

export interface IRAB {
  idKoneksiData: Types.ObjectId;
  totalBiaya?: number | null;
  statusPembayaran: EnumPaymentStatus;
  // Midtrans fields
  orderId?: string | null;
  paymentUrl?: string | null;
  urlRab?: string | null;
  catatan?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRABDocument extends IRAB, Document {}

const rabSchema = new Schema<IRABDocument>(
  {
    idKoneksiData: {
      type: Schema.Types.ObjectId,
      ref: "KoneksiData",
      required: [true, "ID koneksi data diperlukan"],
    },

    totalBiaya: {
      type: Number,
      default: null,
      min: [0, "Total biaya tidak boleh negatif"],
    },

    statusPembayaran: {
      type: String,
      enum: {
        values: [
          "pending",
          "settlement",
          "cancel",
          "expire",
          "refund",
          "chargeback",
          "fraud",
        ],
        message: "Status pembayaran tidak valid",
      },
      required: [true, "Status pembayaran diperlukan"],
      default: "pending",
    },

    // Midtrans: order ID unik per transaksi
    orderId: {
      type: String,
      unique: true,
      trim: true,
      default: null,
    },

    // Midtrans: URL redirect ke halaman pembayaran
    paymentUrl: {
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
        message: "Payment URL tidak valid",
      },
    },

    // URL dokumen RAB (PDF / gambar)
    urlRab: {
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
        message: "URL RAB tidak valid",
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

export const RAB = mongoose.model<IRABDocument>("RAB", rabSchema);
