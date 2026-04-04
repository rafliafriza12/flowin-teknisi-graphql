import mongoose from "mongoose";
import {
  WorkOrder,
  IWorkOrderDocument,
  User,
  IUserDocument,
  DataConnection,
  Survey,
  RAB,
  Pemasangan,
  PengawasanPemasangan,
  PengawasanSetelahPemasangan,
  PenyelesaianLaporan,
  URUTAN_PEKERJAAN,
  JENIS_KE_REF_FIELD,
  JenisPekerjaan,
  StatusPekerjaan,
  StatusTim,
  StatusRespon,
  JENIS_PEKERJAAN,
} from "../models";
import { PaginationInput, PaginatedResponse, GraphQLContext } from "../types";
import {
  validationError,
  notFoundError,
  forbiddenError,
  handleError,
  validateId,
  badUserInputError,
} from "../utils/errors";
import { verifyPayloadSignature } from "../utils/signatureHash";

// ─── Input Interfaces ─────────────────────────────────────────────────────────

export interface BuatWorkOrderInput {
  idKoneksiData: string;
  jenisPekerjaan: JenisPekerjaan;
  teknisiPenanggungJawab: string;
}

export interface TerimaPekerjaanInput {
  workOrderId: string;
}

export interface AjukanPenolakanInput {
  workOrderId: string;
  alasan: string;
}

export interface ReviewPenolakanInput {
  workOrderId: string;
  disetujui: boolean;
  catatan?: string | null;
}

export interface AjukanTimInput {
  workOrderId: string;
  anggotaTim: string[];
}

export interface KerjaSendiriInput {
  workOrderId: string;
}

export interface ReviewTimInput {
  workOrderId: string;
  disetujui: boolean;
  catatan?: string | null;
}

export interface SimpanProgresInput {
  workOrderId: string;
  data: string;
}

export interface KirimHasilInput {
  workOrderId: string;
}

export interface ReviewHasilInput {
  workOrderId: string;
  disetujui: boolean;
  catatan?: string | null;
}

export interface WorkOrderFilterInput {
  status?: StatusPekerjaan;
  jenisPekerjaan?: JenisPekerjaan;
  statusTim?: StatusTim;
  statusRespon?: StatusRespon;
  teknisiPenanggungJawab?: string;
  idKoneksiData?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ambil WorkOrder by ID, throw jika tidak ditemukan.
 */
const findWorkOrderOrFail = async (id: string): Promise<IWorkOrderDocument> => {
  validateId(id, "workOrderId");
  const wo = await WorkOrder.findById(id);
  if (!wo) {
    throw notFoundError(
      `Work order dengan ID ${id} tidak ditemukan`,
      "WorkOrder",
    );
  }
  return wo;
};

/**
 * Validasi bahwa user adalah teknisi penanggung jawab dari work order.
 */
const assertIsPenanggungJawab = (
  wo: IWorkOrderDocument,
  userId: string,
): void => {
  if (wo.teknisiPenanggungJawab.toString() !== userId) {
    throw forbiddenError("Anda bukan teknisi penanggung jawab work order ini");
  }
};

/**
 * Validasi status work order sesuai yang diharapkan.
 */
const assertStatus = (
  wo: IWorkOrderDocument,
  expected: StatusPekerjaan | StatusPekerjaan[],
  errorMsg?: string,
): void => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(wo.status as StatusPekerjaan)) {
    throw validationError(
      errorMsg ||
        `Aksi ini tidak bisa dilakukan pada work order dengan status '${wo.status}'. Status yang diharapkan: ${allowed.join(", ")}`,
    );
  }
};

/**
 * Validasi status tim work order sesuai yang diharapkan.
 */
const assertStatusTim = (
  wo: IWorkOrderDocument,
  expected: StatusTim | StatusTim[],
  errorMsg?: string,
): void => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(wo.statusTim as StatusTim)) {
    throw validationError(
      errorMsg ||
        `Aksi ini tidak bisa dilakukan. Status tim saat ini '${wo.statusTim}'. Diharapkan: ${allowed.join(", ")}`,
    );
  }
};

/**
 * Validasi bahwa work order belum pada status final.
 */
const assertNotFinal = (wo: IWorkOrderDocument): void => {
  if (wo.status === "selesai" || wo.status === "dibatalkan") {
    throw validationError(
      `Work order sudah berstatus '${wo.status}' dan tidak dapat diubah`,
    );
  }
};

/**
 * Validasi status respon awal teknisi.
 */
const assertStatusRespon = (
  wo: IWorkOrderDocument,
  expected: StatusRespon | StatusRespon[],
  errorMsg?: string,
): void => {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(wo.statusRespon as StatusRespon)) {
    throw validationError(
      errorMsg ||
        `Aksi ini tidak bisa dilakukan. Status respon saat ini '${wo.statusRespon}'. Diharapkan: ${allowed.join(", ")}`,
    );
  }
};

/**
 * Gate utama: pastikan pekerjaan sudah diterima oleh teknisi.
 * Semua aksi lanjutan (tim, pengerjaan, kirim, dll) harus melewati gate ini.
 */
const assertPekerjaanDiterima = (wo: IWorkOrderDocument): void => {
  if (wo.statusRespon !== "diterima") {
    throw validationError(
      "Teknisi belum menerima pekerjaan ini. Pekerjaan harus diterima sebelum melanjutkan.",
    );
  }
};

/**
 * Populate work order dengan relasi user dan chain.
 */
const populateWorkOrder = (query: mongoose.Query<any, any>) => {
  return query
    .populate("teknisiPenanggungJawab", "-password -accessToken -refreshToken")
    .populate("tim", "-password -accessToken -refreshToken")
    .populate("riwayatReview.oleh", "-password -accessToken -refreshToken")
    .populate("riwayatRespon.oleh", "-password -accessToken -refreshToken")
    .populate("workOrderSebelumnya");
};

/**
 * Mapping jenisPekerjaan ke Mongoose Model untuk mendapatkan dokumen referensi.
 */
const getRefModel = (jenisPekerjaan: JenisPekerjaan) => {
  const modelMap: Record<JenisPekerjaan, mongoose.Model<any>> = {
    survei: Survey,
    rab: RAB,
    pemasangan: Pemasangan,
    pengawasan_pemasangan: PengawasanPemasangan,
    pengawasan_setelah_pemasangan: PengawasanSetelahPemasangan,
    penyelesaian_laporan: PenyelesaianLaporan,
  };
  return modelMap[jenisPekerjaan];
};

// ─── Service ──────────────────────────────────────────────────────────────────

const workOrderService = {
  // ═══════════════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Ambil semua work orders dengan filter dan pagination.
   */
  getAll: async (
    filter?: WorkOrderFilterInput,
    pagination?: PaginationInput,
  ): Promise<PaginatedResponse<IWorkOrderDocument>> => {
    try {
      const query: Record<string, unknown> = {};

      if (filter?.status) query.status = filter.status;
      if (filter?.jenisPekerjaan) query.jenisPekerjaan = filter.jenisPekerjaan;
      if (filter?.statusTim) query.statusTim = filter.statusTim;
      if (filter?.statusRespon) query.statusRespon = filter.statusRespon;
      if (filter?.teknisiPenanggungJawab) {
        validateId(filter.teknisiPenanggungJawab, "teknisiPenanggungJawab");
        query.teknisiPenanggungJawab = filter.teknisiPenanggungJawab;
      }
      if (filter?.idKoneksiData) {
        validateId(filter.idKoneksiData, "idKoneksiData");
        query.idKoneksiData = filter.idKoneksiData;
      }

      const page = pagination?.page ?? 1;
      const limit = pagination?.limit ?? 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        populateWorkOrder(
          WorkOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ),
        WorkOrder.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw handleError(error, "WorkOrderService.getAll");
    }
  },

  /**
   * Ambil work order berdasarkan ID.
   */
  getById: async (id: string): Promise<IWorkOrderDocument> => {
    try {
      validateId(id);
      const wo = await populateWorkOrder(WorkOrder.findById(id));
      if (!wo) {
        throw notFoundError(
          `Work order dengan ID ${id} tidak ditemukan`,
          "WorkOrder",
        );
      }
      return wo;
    } catch (error) {
      throw handleError(error, "WorkOrderService.getById");
    }
  },

  /**
   * Ambil work orders milik teknisi yang sedang login.
   */
  getByTeknisi: async (
    teknisiId: string,
    filter?: WorkOrderFilterInput,
    pagination?: PaginationInput,
  ): Promise<PaginatedResponse<IWorkOrderDocument>> => {
    try {
      const query: Record<string, unknown> = {
        $or: [{ teknisiPenanggungJawab: teknisiId }, { tim: teknisiId }],
      };

      if (filter?.status) query.status = filter.status;
      if (filter?.jenisPekerjaan) query.jenisPekerjaan = filter.jenisPekerjaan;
      if (filter?.statusTim) query.statusTim = filter.statusTim;
      if (filter?.statusRespon) query.statusRespon = filter.statusRespon;

      const page = pagination?.page ?? 1;
      const limit = pagination?.limit ?? 20;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        populateWorkOrder(
          WorkOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        ),
        WorkOrder.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw handleError(error, "WorkOrderService.getByTeknisi");
    }
  },

  /**
   * Ambil semua work orders berdasarkan ID koneksi data.
   */
  getByKoneksiData: async (
    idKoneksiData: string,
  ): Promise<IWorkOrderDocument[]> => {
    try {
      validateId(idKoneksiData, "idKoneksiData");

      return await populateWorkOrder(
        WorkOrder.find({ idKoneksiData }).sort({ createdAt: 1 }),
      );
    } catch (error) {
      throw handleError(error, "WorkOrderService.getByKoneksiData");
    }
  },

  /**
   * Ambil rantai workflow lengkap untuk satu koneksi data.
   *
   * Mengembalikan semua tahap pekerjaan (sesuai URUTAN_PEKERJAAN) dengan status:
   * - "selesai"       → WO ada dan status === "selesai"
   * - "aktif"         → WO ada dan masih dalam proses (belum selesai/dibatalkan)
   * - "dibatalkan"    → WO ada dan status === "dibatalkan"
   * - "belum_dibuat"  → belum ada WO untuk tahap ini
   *
   * Juga menampilkan apakah tahap bisa dibuat sekarang (prerequisite terpenuhi).
   */
  getWorkflowChain: async (
    idKoneksiData: string,
  ): Promise<
    {
      jenisPekerjaan: JenisPekerjaan;
      workOrder: IWorkOrderDocument | null;
      chainStatus: string;
      urutan: number;
      bisaDibuat: boolean;
    }[]
  > => {
    try {
      validateId(idKoneksiData, "idKoneksiData");

      // Ambil semua WO untuk koneksi data ini
      const allWOs = await populateWorkOrder(
        WorkOrder.find({ idKoneksiData }).sort({ createdAt: 1 }),
      );

      // Urutan rantai utama (exclude standalone)
      const chainOrder: JenisPekerjaan[] = [
        "survei",
        "rab",
        "pemasangan",
        "pengawasan_pemasangan",
        "pengawasan_setelah_pemasangan",
      ];

      // penyelesaian_laporan berdiri sendiri, ditambahkan di akhir
      const allStages: JenisPekerjaan[] = [
        ...chainOrder,
        "penyelesaian_laporan",
      ];

      const result: {
        jenisPekerjaan: JenisPekerjaan;
        workOrder: IWorkOrderDocument | null;
        chainStatus: string;
        urutan: number;
        bisaDibuat: boolean;
      }[] = [];

      for (let i = 0; i < allStages.length; i++) {
        const jenis = allStages[i];

        // Cari WO aktif (non-dibatalkan) untuk tahap ini, atau fallback ke yang dibatalkan
        const activeWO = allWOs.find(
          (wo: IWorkOrderDocument) =>
            (wo.jenisPekerjaan as string) === jenis &&
            wo.status !== "dibatalkan",
        );
        const cancelledWO = !activeWO
          ? allWOs.find(
              (wo: IWorkOrderDocument) =>
                (wo.jenisPekerjaan as string) === jenis &&
                wo.status === "dibatalkan",
            )
          : null;

        const wo = activeWO || cancelledWO || null;

        let chainStatus: string;
        if (!wo) {
          chainStatus = "belum_dibuat";
        } else if (wo.status === "selesai") {
          chainStatus = "selesai";
        } else if (wo.status === "dibatalkan") {
          chainStatus = "dibatalkan";
        } else {
          chainStatus = "aktif";
        }

        // Cek apakah bisa dibuat — menggunakan cekPrerequisite yang sudah ada
        let bisaDibuat = false;
        if (chainStatus === "belum_dibuat" || chainStatus === "dibatalkan") {
          try {
            bisaDibuat = await workOrderService.cekPrerequisite(
              idKoneksiData,
              jenis,
            );
          } catch {
            bisaDibuat = false;
          }
        }

        result.push({
          jenisPekerjaan: jenis,
          workOrder: wo,
          chainStatus,
          urutan: i + 1,
          bisaDibuat,
        });
      }

      return result;
    } catch (error) {
      throw handleError(error, "WorkOrderService.getWorkflowChain");
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CEK PREREQUISITE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Cek apakah prerequisite untuk jenis pekerjaan tertentu sudah terpenuhi.
   *
   * Alur validasi:
   * 1. DataConnection harus APPROVED
   * 2. Belum ada work order aktif untuk jenis yang sama pada koneksi data ini
   * 3. Jika ada prerequisite pekerjaan → work order prerequisite harus berstatus "selesai"
   * 4. Untuk pemasangan → RAB harus statusPembayaran === "settlement"
   */
  cekPrerequisite: async (
    idKoneksiData: string,
    jenisPekerjaan: JenisPekerjaan,
  ): Promise<boolean> => {
    try {
      validateId(idKoneksiData, "idKoneksiData");

      if (!JENIS_PEKERJAAN.includes(jenisPekerjaan)) {
        throw badUserInputError(
          `Jenis pekerjaan '${jenisPekerjaan}' tidak valid`,
          "jenisPekerjaan",
        );
      }

      // 1. DataConnection harus ada dan APPROVED
      const koneksiData = await DataConnection.findById(idKoneksiData).lean();
      if (!koneksiData) {
        return false;
      }
      if (koneksiData.StatusPengajuan !== "APPROVED") {
        return false;
      }

      // 2. Belum ada work order aktif untuk jenis yang sama
      const existing = await WorkOrder.findOne({
        idKoneksiData,
        jenisPekerjaan,
        status: { $nin: ["dibatalkan"] },
      }).lean();
      if (existing) {
        return false;
      }

      // 3. Cek prerequisite pekerjaan sebelumnya
      const prerequisite = URUTAN_PEKERJAAN[jenisPekerjaan];
      if (prerequisite) {
        const prereqWO = await WorkOrder.findOne({
          idKoneksiData,
          jenisPekerjaan: prerequisite,
          status: "selesai",
        }).lean();
        if (!prereqWO) {
          return false;
        }

        // 4. Khusus pemasangan → RAB harus sudah settlement
        if (jenisPekerjaan === "pemasangan" && prereqWO.idRAB) {
          const rab = await RAB.findById(prereqWO.idRAB).lean();
          if (!rab || rab.statusPembayaran !== "settlement") {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      throw handleError(error, "WorkOrderService.cekPrerequisite");
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * [ADMIN] Buat work order baru dan tugaskan teknisi.
   *
   * Alur:
   * 1. Validasi prerequisite terpenuhi
   * 2. Validasi teknisi aktif & tidak sedang mengerjakan pekerjaan lain
   * 3. Buat work order dengan status "menunggu_respon", statusRespon "belum_direspon"
   * 4. TIDAK update user.pekerjaanSekarang (baru di-update saat teknisi menerima)
   */
  buatWorkOrder: async (
    input: BuatWorkOrderInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      // Validasi input IDs
      validateId(input.idKoneksiData, "idKoneksiData");
      validateId(input.teknisiPenanggungJawab, "teknisiPenanggungJawab");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      // Cek prerequisite
      const isEligible = await workOrderService.cekPrerequisite(
        input.idKoneksiData,
        input.jenisPekerjaan,
      );
      if (!isEligible) {
        throw validationError(
          `Prerequisite untuk pekerjaan '${input.jenisPekerjaan}' belum terpenuhi. ` +
            `Pastikan pekerjaan sebelumnya sudah selesai dan semua kondisi terpenuhi.`,
        );
      }

      // Validasi teknisi ada dan aktif
      const teknisi = await User.findById(input.teknisiPenanggungJawab);
      if (!teknisi) {
        throw notFoundError(
          `Teknisi dengan ID ${input.teknisiPenanggungJawab} tidak ditemukan`,
          "User",
        );
      }
      if (!teknisi.isActive) {
        throw validationError("Teknisi yang dipilih tidak aktif");
      }

      // Cek apakah teknisi sudah punya pekerjaan aktif
      if (teknisi.pekerjaanSekarang) {
        throw validationError(
          `Teknisi '${teknisi.namaLengkap}' sedang mengerjakan pekerjaan lain dan tidak bisa ditugaskan`,
        );
      }

      // Cari work order sebelumnya dalam rantai (jika ada prerequisite)
      let workOrderSebelumnya: mongoose.Types.ObjectId | null = null;
      const prerequisite = URUTAN_PEKERJAAN[input.jenisPekerjaan];
      if (prerequisite) {
        const prereqWO = await WorkOrder.findOne({
          idKoneksiData: input.idKoneksiData,
          jenisPekerjaan: prerequisite,
          status: "selesai",
        }).lean();
        if (prereqWO) {
          workOrderSebelumnya = prereqWO._id as mongoose.Types.ObjectId;
        }
      }

      // Buat work order — status awal "menunggu_respon"
      const wo = new WorkOrder({
        idKoneksiData: input.idKoneksiData,
        jenisPekerjaan: input.jenisPekerjaan,
        teknisiPenanggungJawab: input.teknisiPenanggungJawab,
        tim: [],
        statusTim: "belum_diajukan",
        status: "menunggu_respon",
        statusRespon: "belum_direspon",
        workOrderSebelumnya,
        riwayatReview: [],
        riwayatRespon: [],
      });

      await wo.save();

      // TIDAK update pekerjaanSekarang di sini.
      // pekerjaanSekarang baru di-set saat teknisi MENERIMA pekerjaan.

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.buatWorkOrder");
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // RESPON AWAL TEKNISI (gate utama)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * [TEKNISI] Terima pekerjaan yang ditugaskan.
   *
   * Kondisi:
   * - Hanya penanggung jawab
   * - statusRespon harus "belum_direspon" ATAU "penolakan_ditolak"
   *   (jika penolakan sebelumnya ditolak admin, teknisi wajib menerima)
   * - WO belum final
   *
   * Efek:
   * - statusRespon → "diterima"
   * - status → "menunggu_tim"
   * - Update pekerjaanSekarang teknisi
   */
  terimaPekerjaan: async (
    input: TerimaPekerjaanInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertStatusRespon(
        wo,
        ["belum_direspon", "penolakan_ditolak"],
        wo.statusRespon === "diterima"
          ? "Anda sudah menerima pekerjaan ini sebelumnya"
          : wo.statusRespon === "penolakan_diajukan"
            ? "Penolakan Anda sedang dalam proses review admin. Tunggu keputusan admin."
            : wo.statusRespon === "penolakan_diterima"
              ? "Pekerjaan ini sudah dibatalkan karena penolakan Anda telah diterima admin"
              : `Status respon '${wo.statusRespon}' tidak memungkinkan aksi ini`,
      );

      // Cek apakah teknisi sudah punya pekerjaan aktif lain
      const teknisi = await User.findById(wo.teknisiPenanggungJawab);
      if (teknisi?.pekerjaanSekarang) {
        throw validationError(
          `Anda sedang mengerjakan pekerjaan lain. Selesaikan terlebih dahulu sebelum menerima pekerjaan baru.`,
        );
      }

      // Update respon
      wo.statusRespon = "diterima";
      wo.status = "menunggu_tim";

      wo.riwayatRespon.push({
        aksi: "diterima",
        alasan: null,
        oleh: context.user!._id,
        tanggal: new Date(),
      });

      await wo.save();

      // Update pekerjaanSekarang teknisi — baru di sini
      await User.findByIdAndUpdate(wo.teknisiPenanggungJawab, {
        pekerjaanSekarang: wo._id,
      });

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.terimaPekerjaan");
    }
  },

  /**
   * [TEKNISI] Ajukan penolakan pekerjaan.
   *
   * Kondisi:
   * - Hanya penanggung jawab
   * - statusRespon harus "belum_direspon"
   *   (tidak bisa menolak jika sudah diterima atau sedang review penolakan)
   * - WO belum final
   *
   * Efek:
   * - statusRespon → "penolakan_diajukan"
   * - alasanPenolakan diisi
   * - Menunggu review admin
   */
  ajukanPenolakan: async (
    input: AjukanPenolakanInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertStatusRespon(
        wo,
        "belum_direspon",
        wo.statusRespon === "diterima"
          ? "Anda sudah menerima pekerjaan ini, tidak bisa mengajukan penolakan"
          : wo.statusRespon === "penolakan_diajukan"
            ? "Penolakan sudah diajukan sebelumnya dan sedang menunggu review admin"
            : wo.statusRespon === "penolakan_ditolak"
              ? "Penolakan Anda sebelumnya sudah ditolak admin. Anda wajib menerima pekerjaan ini."
              : wo.statusRespon === "penolakan_diterima"
                ? "Pekerjaan ini sudah dibatalkan karena penolakan Anda telah diterima admin"
                : `Status respon '${wo.statusRespon}' tidak memungkinkan aksi ini`,
      );

      // Validasi alasan
      if (!input.alasan || input.alasan.trim().length < 10) {
        throw validationError(
          "Alasan penolakan wajib diisi minimal 10 karakter",
        );
      }

      wo.statusRespon = "penolakan_diajukan";
      wo.alasanPenolakan = input.alasan.trim();

      wo.riwayatRespon.push({
        aksi: "penolakan_diajukan",
        alasan: input.alasan.trim(),
        oleh: context.user!._id,
        tanggal: new Date(),
      });

      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.ajukanPenolakan");
    }
  },

  /**
   * [ADMIN] Review penolakan teknisi.
   *
   * Kondisi:
   * - statusRespon harus "penolakan_diajukan"
   * - WO belum final
   *
   * Jika disetujui (admin terima penolakan):
   * - statusRespon → "penolakan_diterima"
   * - status → "dibatalkan"
   * - Riwayat tetap tersimpan
   * - pekerjaanSekarang TIDAK perlu direset (belum pernah di-set)
   *
   * Jika ditolak (admin tolak penolakan):
   * - statusRespon → "penolakan_ditolak"
   * - status tetap "menunggu_respon"
   * - Teknisi wajib menerima pekerjaan (via terimaPekerjaan)
   */
  reviewPenolakan: async (
    input: ReviewPenolakanInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertNotFinal(wo);
      assertStatusRespon(
        wo,
        "penolakan_diajukan",
        "Tidak ada penolakan yang perlu direview",
      );

      if (input.disetujui) {
        // Admin MENERIMA penolakan teknisi → WO dibatalkan
        wo.statusRespon = "penolakan_diterima";
        wo.status = "dibatalkan";
        wo.catatanReviewPenolakan = input.catatan?.trim() || null;

        wo.riwayatRespon.push({
          aksi: "penolakan_diterima",
          alasan: input.catatan?.trim() || null,
          oleh: context.user!._id,
          tanggal: new Date(),
        });

        // Tidak perlu reset pekerjaanSekarang karena belum pernah di-set
      } else {
        // Admin MENOLAK penolakan teknisi → teknisi wajib menerima
        if (!input.catatan || input.catatan.trim().length < 10) {
          throw validationError(
            "Catatan penolakan wajib diisi minimal 10 karakter (jelaskan alasan teknisi harus menerima)",
          );
        }

        wo.statusRespon = "penolakan_ditolak";
        // Status tetap menunggu_respon — teknisi harus menerima
        wo.status = "menunggu_respon";
        wo.catatanReviewPenolakan = input.catatan.trim();

        wo.riwayatRespon.push({
          aksi: "penolakan_ditolak",
          alasan: input.catatan.trim(),
          oleh: context.user!._id,
          tanggal: new Date(),
        });
      }

      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.reviewPenolakan");
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WORKFLOW SETELAH PENERIMAAN
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * [TEKNISI] Ajukan anggota tim untuk work order.
   *
   * Gate: pekerjaan harus sudah diterima (statusRespon === "diterima").
   *
   * Alur:
   * 1. Hanya penanggung jawab yang bisa mengajukan
   * 2. Status harus "menunggu_tim" dan statusTim "belum_diajukan" atau "ditolak"
   * 3. Validasi semua anggota tim
   * 4. Update status ke "tim_diajukan", statusTim ke "diajukan"
   */
  ajukanTim: async (
    input: AjukanTimInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      // Gate utama: pekerjaan harus sudah diterima
      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertPekerjaanDiterima(wo);
      assertStatus(
        wo,
        ["menunggu_tim", "ditugaskan"],
        "Tim hanya bisa diajukan saat status 'menunggu_tim' atau 'ditugaskan'",
      );
      assertStatusTim(
        wo,
        ["belum_diajukan", "ditolak"],
        "Tim sudah diajukan atau disetujui, tidak bisa mengajukan ulang",
      );

      // Validasi anggota tim
      if (!input.anggotaTim || input.anggotaTim.length === 0) {
        throw validationError("Minimal satu anggota tim harus diajukan");
      }

      const uniqueIds = [...new Set(input.anggotaTim)];
      for (const id of uniqueIds) {
        validateId(id, "anggotaTim");
      }

      // Penanggung jawab tidak boleh ada di anggota tim
      if (uniqueIds.includes(wo.teknisiPenanggungJawab.toString())) {
        throw validationError(
          "Teknisi penanggung jawab tidak perlu disertakan dalam anggota tim",
        );
      }

      // Validasi semua anggota tim adalah user aktif
      const users = await User.find({
        _id: { $in: uniqueIds },
        isActive: true,
      }).lean();

      if (users.length !== uniqueIds.length) {
        const foundIds = users.map((u) => u._id.toString());
        const missing = uniqueIds.filter((id) => !foundIds.includes(id));
        throw validationError(
          `Beberapa anggota tim tidak ditemukan atau tidak aktif: ${missing.join(", ")}`,
        );
      }

      // Cek apakah ada anggota tim yang sedang mengerjakan pekerjaan lain
      const busyMembers = users.filter(
        (u) =>
          u.pekerjaanSekarang !== null &&
          u.pekerjaanSekarang !== undefined &&
          u.pekerjaanSekarang.toString() !== wo._id.toString(),
      );
      if (busyMembers.length > 0) {
        const names = busyMembers.map((u) => u.namaLengkap).join(", ");
        throw validationError(
          `Teknisi berikut sedang mengerjakan pekerjaan lain: ${names}`,
        );
      }

      // Update work order
      wo.tim = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
      wo.statusTim = "diajukan";
      wo.status = "tim_diajukan";
      wo.catatanTim = null;

      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.ajukanTim");
    }
  },

  /**
   * [TEKNISI] Memilih untuk bekerja sendiri tanpa tim tambahan.
   *
   * Gate: pekerjaan harus sudah diterima (statusRespon === "diterima").
   *
   * Alur:
   * 1. Hanya penanggung jawab yang bisa memilih
   * 2. Status harus "menunggu_tim"
   * 3. Tim kosong, statusTim → "disetujui", status → "ditugaskan"
   */
  kerjaSendiri: async (
    input: KerjaSendiriInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertPekerjaanDiterima(wo);
      assertStatus(
        wo,
        "menunggu_tim",
        "Kerja sendiri hanya bisa dipilih saat status 'menunggu_tim'",
      );
      assertStatusTim(
        wo,
        ["belum_diajukan", "ditolak"],
        "Tim sudah diajukan/disetujui, tidak bisa memilih kerja sendiri",
      );

      wo.tim = [];
      wo.statusTim = "disetujui";
      wo.status = "ditugaskan";
      wo.catatanTim = null;

      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.kerjaSendiri");
    }
  },

  /**
   * [ADMIN] Review pengajuan tim (setujui/tolak).
   *
   * Alur:
   * Jika disetujui:
   *   - statusTim → "disetujui", status → "ditugaskan"
   * Jika ditolak:
   *   - statusTim → "ditolak", status → "menunggu_tim"
   *   - Teknisi bisa mengajukan ulang
   */
  reviewTim: async (
    input: ReviewTimInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertNotFinal(wo);
      assertStatusTim(
        wo,
        "diajukan",
        "Tidak ada pengajuan tim yang perlu direview",
      );

      if (input.disetujui) {
        wo.statusTim = "disetujui";
        wo.status = "ditugaskan";
        wo.catatanTim = null;

        // Update pekerjaanSekarang untuk semua anggota tim
        if (wo.tim.length > 0) {
          await User.updateMany(
            { _id: { $in: wo.tim } },
            { pekerjaanSekarang: wo._id },
          );
        }
      } else {
        if (!input.catatan || input.catatan.trim().length < 10) {
          throw validationError(
            "Catatan penolakan tim wajib diisi minimal 10 karakter",
          );
        }
        wo.statusTim = "ditolak";
        wo.status = "menunggu_tim";
        wo.catatanTim = input.catatan.trim();
        wo.tim = [];
      }

      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.reviewTim");
    }
  },

  /**
   * [TEKNISI] Simpan progres pekerjaan (draft).
   *
   * Gate: pekerjaan harus sudah diterima (statusRespon === "diterima").
   *
   * Alur:
   * 1. Hanya penanggung jawab yang bisa menyimpan
   * 2. Status harus "ditugaskan", "sedang_dikerjakan", atau "revisi"
   * 3. Parse data JSON → buat/update dokumen referensi sesuai jenisPekerjaan
   * 4. Status → "sedang_dikerjakan"
   *
   * `data` berisi JSON string dari field dokumen referensi.
   */
  simpanProgres: async (
    input: SimpanProgresInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertPekerjaanDiterima(wo);
      assertStatus(
        wo,
        ["ditugaskan", "sedang_dikerjakan", "revisi"],
        "Progres hanya bisa disimpan saat status 'ditugaskan', 'sedang_dikerjakan', atau 'revisi'",
      );

      // Tim harus sudah disetujui (atau kerja sendiri)
      if (wo.statusTim !== "disetujui") {
        throw validationError(
          "Tim harus sudah disetujui sebelum mulai mengerjakan",
        );
      }

      // Parse data
      let parsedData: Record<string, unknown>;
      try {
        parsedData = JSON.parse(input.data);
      } catch {
        throw validationError(
          "Format data tidak valid, harus berupa JSON string",
        );
      }

      // Buat atau update dokumen referensi
      const refField = JENIS_KE_REF_FIELD[wo.jenisPekerjaan];
      const RefModel = getRefModel(wo.jenisPekerjaan);
      const existingRefId = (wo as unknown as Record<string, unknown>)[
        refField
      ] as mongoose.Types.ObjectId | null;

      if (existingRefId) {
        // Update existing
        await RefModel.findByIdAndUpdate(existingRefId, parsedData, {
          runValidators: true,
        });
      } else {
        // Create new — tambahkan relasi ke koneksi data / pemasangan
        const createData = { ...parsedData };

        // Set foreign key berdasarkan jenis pekerjaan
        if (["survei", "rab", "pemasangan"].includes(wo.jenisPekerjaan)) {
          createData.idKoneksiData = wo.idKoneksiData;
        }

        // Untuk pengawasan, ambil idPemasangan dari work order pemasangan selesai
        if (
          wo.jenisPekerjaan === "pengawasan_pemasangan" ||
          wo.jenisPekerjaan === "pengawasan_setelah_pemasangan"
        ) {
          const pemasanganWO = await WorkOrder.findOne({
            idKoneksiData: wo.idKoneksiData,
            jenisPekerjaan: "pemasangan",
            status: "selesai",
          }).lean();
          if (pemasanganWO?.idPemasangan) {
            createData.idPemasangan = pemasanganWO.idPemasangan;
          }
        }

        // Untuk penyelesaian laporan, idLaporan harus ada di data
        const doc = new RefModel(createData);
        await doc.save();

        // Link dokumen ke work order
        (wo as unknown as Record<string, unknown>)[refField] = doc._id;
      }

      wo.status = "sedang_dikerjakan";
      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.simpanProgres");
    }
  },

  /**
   * [TEKNISI] Kirim hasil pekerjaan untuk di-review admin.
   *
   * Gate: pekerjaan harus sudah diterima (statusRespon === "diterima").
   *
   * Alur:
   * 1. Hanya penanggung jawab
   * 2. Status harus "sedang_dikerjakan" atau "revisi"
   * 3. Dokumen referensi harus sudah ada
   * 4. Status → "dikirim"
   */
  kirimHasil: async (
    input: KirimHasilInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertIsPenanggungJawab(wo, context.user!._id.toString());
      assertNotFinal(wo);
      assertPekerjaanDiterima(wo);
      assertStatus(
        wo,
        ["sedang_dikerjakan", "revisi"],
        "Hasil hanya bisa dikirim saat status 'sedang_dikerjakan' atau 'revisi'",
      );

      // Pastikan dokumen referensi sudah ada
      const refField = JENIS_KE_REF_FIELD[wo.jenisPekerjaan];
      const refId = (wo as unknown as Record<string, unknown>)[refField];
      if (!refId) {
        throw validationError(
          "Belum ada data pekerjaan yang disimpan. Simpan progres terlebih dahulu.",
        );
      }

      wo.status = "dikirim";
      wo.catatanReview = null;
      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.kirimHasil");
    }
  },

  /**
   * [ADMIN] Review hasil pekerjaan (setujui/tolak).
   *
   * Alur:
   * Jika disetujui:
   *   - status → "selesai"
   *   - Tambah riwayat review
   *   - Lepaskan pekerjaanSekarang teknisi (jika jenis pekerjaan terakhir)
   * Jika ditolak:
   *   - status → "revisi"
   *   - Catatan wajib diisi
   *   - Tambah riwayat review
   *   - Teknisi bisa memperbaiki dan mengirim ulang
   */
  reviewHasil: async (
    input: ReviewHasilInput,
    context: GraphQLContext,
  ): Promise<IWorkOrderDocument> => {
    try {
      validateId(input.workOrderId, "workOrderId");

      // Verifikasi signature
      verifyPayloadSignature(context.req.headers, input);

      const wo = await findWorkOrderOrFail(input.workOrderId);

      assertNotFinal(wo);
      assertStatus(
        wo,
        "dikirim",
        "Review hanya bisa dilakukan pada work order yang sudah dikirim",
      );

      const reviewEntry = {
        status: input.disetujui ? ("disetujui" as const) : ("ditolak" as const),
        catatan: input.catatan?.trim() || null,
        oleh: context.user!._id,
        tanggal: new Date(),
      };

      if (input.disetujui) {
        wo.status = "selesai";
        wo.catatanReview = null;

        // Lepaskan pekerjaanSekarang untuk penanggung jawab + semua anggota tim
        const allTeknisiIds = [wo.teknisiPenanggungJawab, ...wo.tim];
        await User.updateMany(
          {
            _id: { $in: allTeknisiIds },
            pekerjaanSekarang: wo._id,
          },
          { pekerjaanSekarang: null },
        );
      } else {
        if (!input.catatan || input.catatan.trim().length < 10) {
          throw validationError(
            "Catatan penolakan wajib diisi minimal 10 karakter",
          );
        }
        wo.status = "revisi";
        wo.catatanReview = input.catatan!.trim();
      }

      wo.riwayatReview.push(reviewEntry);
      await wo.save();

      return await workOrderService.getById(wo._id.toString());
    } catch (error) {
      throw handleError(error, "WorkOrderService.reviewHasil");
    }
  },

  /**
   * [ADMIN] Batalkan work order.
   *
   * Alur:
   * 1. Work order tidak boleh sudah selesai
   * 2. Status → "dibatalkan"
   * 3. Lepaskan pekerjaanSekarang teknisi (hanya jika pekerjaan sudah diterima)
   */
  batalkanWorkOrder: async (
    id: string,
    catatan: string | null | undefined,
    context: GraphQLContext,
  ): Promise<{ success: boolean; message: string }> => {
    try {
      validateId(id);

      const wo = await findWorkOrderOrFail(id);

      if (wo.status === "selesai") {
        throw validationError(
          "Work order yang sudah selesai tidak dapat dibatalkan",
        );
      }
      if (wo.status === "dibatalkan") {
        throw validationError("Work order sudah dibatalkan sebelumnya");
      }

      wo.status = "dibatalkan";
      if (catatan) {
        wo.catatanReview = catatan.trim();
      }

      await wo.save();

      // Lepaskan pekerjaanSekarang hanya jika pekerjaan sudah diterima
      // (pekerjaanSekarang baru di-set saat teknisi menerima)
      if (wo.statusRespon === "diterima") {
        const allTeknisiIds = [wo.teknisiPenanggungJawab, ...wo.tim];
        await User.updateMany(
          {
            _id: { $in: allTeknisiIds },
            pekerjaanSekarang: wo._id,
          },
          { pekerjaanSekarang: null },
        );
      }

      return {
        success: true,
        message: "Work order berhasil dibatalkan",
      };
    } catch (error) {
      throw handleError(error, "WorkOrderService.batalkanWorkOrder");
    }
  },
};

export default workOrderService;
