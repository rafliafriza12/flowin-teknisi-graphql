import MidtransClient from "midtrans-client";
import { config } from "../config";
import { RAB, IRABDocument } from "../models/RAB";
import { DataConnection } from "../models/DataConnection";
import { handleError } from "../utils/errors";
import mongoose from "mongoose";

// ─── Midtrans Snap instance ───────────────────────────────────────────────────

const snap = new MidtransClient.Snap({
  isProduction: config.midtrans.isProduction,
  serverKey: config.midtrans.serverKey,
  clientKey: config.midtrans.clientKey,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Generate orderId unik dengan format: RAB-<koneksiDataId>-<timestamp>
 */
const generateOrderId = (idKoneksiData: string): string => {
  const timestamp = Date.now();
  const short = idKoneksiData.slice(-6).toUpperCase();
  return `RAB-${short}-${timestamp}`;
};

/**
 * Hitung gross amount: totalBiaya + biaya admin Midtrans (flat Rp 4.000).
 * Midtrans akan menampilkan breakdown sendiri di Snap UI.
 */
const MIDTRANS_ADMIN_FEE = 4000;

const hitungGrossAmount = (totalBiaya: number): number => {
  return Math.round(totalBiaya + MIDTRANS_ADMIN_FEE);
};

// ─── Service ─────────────────────────────────────────────────────────────────

const paymentService = {
  /**
   * Generate Midtrans Snap payment link untuk RAB yang sudah disetujui admin.
   *
   * Alur:
   * 1. Ambil dokumen RAB dan koneksi data terkait
   * 2. Jika sudah ada paymentUrl dan status masih pending → return yang sudah ada
   * 3. Generate orderId baru, hit Midtrans Snap API
   * 4. Simpan orderId + paymentUrl ke RAB
   */
  generatePaymentLink: async (
    rabId: string,
  ): Promise<{ orderId: string; paymentUrl: string }> => {
    try {
      const rab = (await RAB.findById(rabId).lean()) as IRABDocument | null;
      if (!rab) {
        throw new Error(`RAB dengan ID '${rabId}' tidak ditemukan`);
      }

      if (!rab.totalBiaya || rab.totalBiaya <= 0) {
        throw new Error(
          "Total biaya RAB belum diisi atau tidak valid. Isi total biaya terlebih dahulu.",
        );
      }

      // Jika sudah ada paymentUrl dan status masih pending → reuse
      if (rab.paymentUrl && rab.orderId && rab.statusPembayaran === "pending") {
        return { orderId: rab.orderId, paymentUrl: rab.paymentUrl };
      }

      // Ambil data koneksi untuk customer detail
      const koneksiData = await DataConnection.findById(rab.idKoneksiData);
      const pelangganId = koneksiData?.IdPelanggan;

      const orderId = generateOrderId(rab.idKoneksiData.toString());
      const grossAmount = hitungGrossAmount(rab.totalBiaya);

      const transactionDetails = {
        order_id: orderId,
        gross_amount: grossAmount,
      };

      const itemDetails = [
        {
          id: "BIAYA-PEMASANGAN",
          price: rab.totalBiaya,
          quantity: 1,
          name: "Biaya Pemasangan Sambungan Air",
        },
        {
          id: "ADMIN-MIDTRANS",
          price: MIDTRANS_ADMIN_FEE,
          quantity: 1,
          name: "Biaya Administrasi Pembayaran",
        },
      ];

      const customerDetails = pelangganId
        ? { customer_id: pelangganId.toString() }
        : undefined;

      // enabled_payments: [] → user bebas memilih metode di Snap UI
      const parameter = {
        transaction_details: transactionDetails,
        item_details: itemDetails,
        ...(customerDetails && { customer_details: customerDetails }),
        callbacks: {
          finish: `${config.frontendUrl}/payment/finish`,
          error: `${config.frontendUrl}/payment/error`,
          pending: `${config.frontendUrl}/payment/pending`,
        },
      };

      const transaction = await snap.createTransaction(parameter);
      const paymentUrl: string =
        transaction.redirect_url ??
        `https://${config.midtrans.isProduction ? "app" : "app.sandbox"}.midtrans.com/snap/v2/vtweb/${transaction.token}`;

      // Simpan ke RAB
      await RAB.findByIdAndUpdate(rabId, {
        orderId,
        paymentUrl,
        statusPembayaran: "pending",
      });

      return { orderId, paymentUrl };
    } catch (error) {
      throw handleError(error, "PaymentService.generatePaymentLink");
    }
  },

  /**
   * Handle Midtrans webhook notification — update statusPembayaran di RAB.
   * Dipanggil dari endpoint POST /api/payment/notification.
   */
  handleNotification: async (
    notificationBody: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const core = new MidtransClient.CoreApi({
        isProduction: config.midtrans.isProduction,
        serverKey: config.midtrans.serverKey,
        clientKey: config.midtrans.clientKey,
      });

      // midtrans-client attaches `transaction` at runtime; cast to any for TS
      const statusResponse = await (core as any).transaction.notification(
        notificationBody,
      );

      const orderId: string = statusResponse.order_id;
      const transactionStatus: string = statusResponse.transaction_status;
      const fraudStatus: string = statusResponse.fraud_status;

      let newStatus: IRABDocument["statusPembayaran"] | null = null;

      if (transactionStatus === "capture") {
        newStatus = fraudStatus === "accept" ? "settlement" : "fraud";
      } else if (transactionStatus === "settlement") {
        newStatus = "settlement";
      } else if (
        transactionStatus === "cancel" ||
        transactionStatus === "deny"
      ) {
        newStatus = "cancel";
      } else if (transactionStatus === "expire") {
        newStatus = "expire";
      } else if (transactionStatus === "refund") {
        newStatus = "refund";
      } else if (transactionStatus === "chargeback") {
        newStatus = "chargeback";
      }

      if (newStatus) {
        await RAB.findOneAndUpdate(
          { orderId },
          { statusPembayaran: newStatus },
        );
      }
    } catch (error) {
      throw handleError(error, "PaymentService.handleNotification");
    }
  },
};

export default paymentService;
