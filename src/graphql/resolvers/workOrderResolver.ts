import mongoose from "mongoose";
import { GraphQLContext, ByIdInput, PaginationInput } from "../../types";
import { handleError } from "../../utils/errors";
import services from "../../services";
import { DataConnection } from "../../models";
import {
  BuatWorkOrderInput,
  TerimaPekerjaanInput,
  AjukanPenolakanInput,
  ReviewPenolakanInput,
  AjukanTimInput,
  KerjaSendiriInput,
  ReviewTimInput,
  SimpanProgresInput,
  KirimHasilInput,
  ReviewHasilInput,
  WorkOrderFilterInput,
} from "../../services/workOrderService";

// ─── Arg Interfaces ───────────────────────────────────────────────────────────

interface BuatWorkOrderArgs {
  input: BuatWorkOrderInput;
}

interface TerimaPekerjaanArgs {
  input: TerimaPekerjaanInput;
}

interface AjukanPenolakanArgs {
  input: AjukanPenolakanInput;
}

interface ReviewPenolakanArgs {
  input: ReviewPenolakanInput;
}

interface AjukanTimArgs {
  input: AjukanTimInput;
}

interface KerjaSendiriArgs {
  input: KerjaSendiriInput;
}

interface ReviewTimArgs {
  input: ReviewTimInput;
}

interface SimpanProgresArgs {
  input: SimpanProgresInput;
}

interface KirimHasilArgs {
  input: KirimHasilInput;
}

interface ReviewHasilArgs {
  input: ReviewHasilInput;
}

interface WorkOrdersArgs {
  filter?: WorkOrderFilterInput;
  pagination?: PaginationInput;
}

interface WorkOrdersByKoneksiDataArgs {
  idKoneksiData: string;
}

interface CekPrerequisiteArgs {
  idKoneksiData: string;
  jenisPekerjaan: string;
}

interface BatalkanWorkOrderArgs {
  id: string;
  catatan?: string | null;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

const workOrderResolver = {
  Query: {
    workOrders: async (
      _: unknown,
      args: WorkOrdersArgs,
      _context: GraphQLContext,
    ) => {
      try {
        return await services.workOrderService.getAll(
          args.filter,
          args.pagination,
        );
      } catch (error) {
        throw handleError(error, "Resolver.workOrders");
      }
    },

    workOrder: async (_: unknown, args: ByIdInput) => {
      try {
        return await services.workOrderService.getById(args.id);
      } catch (error) {
        throw handleError(error, "Resolver.workOrder");
      }
    },

    workOrdersSaya: async (
      _: unknown,
      args: WorkOrdersArgs,
      context: GraphQLContext,
    ) => {
      try {
        return await services.workOrderService.getByTeknisi(
          context.user!._id.toString(),
          args.filter,
          args.pagination,
        );
      } catch (error) {
        throw handleError(error, "Resolver.workOrdersSaya");
      }
    },

    workOrdersByKoneksiData: async (
      _: unknown,
      args: WorkOrdersByKoneksiDataArgs,
    ) => {
      try {
        return await services.workOrderService.getByKoneksiData(
          args.idKoneksiData,
        );
      } catch (error) {
        throw handleError(error, "Resolver.workOrdersByKoneksiData");
      }
    },

    workflowChain: async (_: unknown, args: WorkOrdersByKoneksiDataArgs) => {
      try {
        return await services.workOrderService.getWorkflowChain(
          args.idKoneksiData,
        );
      } catch (error) {
        throw handleError(error, "Resolver.workflowChain");
      }
    },

    cekPrerequisitePekerjaan: async (_: unknown, args: CekPrerequisiteArgs) => {
      try {
        return await services.workOrderService.cekPrerequisite(
          args.idKoneksiData,
          args.jenisPekerjaan as any,
        );
      } catch (error) {
        throw handleError(error, "Resolver.cekPrerequisitePekerjaan");
      }
    },

    progresWorkOrder: async (_: unknown, args: { workOrderId: string }) => {
      try {
        return await services.workOrderService.getProgres(args.workOrderId);
      } catch (error) {
        throw handleError(error, "Resolver.progresWorkOrder");
      }
    },
  },

  Mutation: {
    buatWorkOrder: async (
      _: unknown,
      args: BuatWorkOrderArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.buatWorkOrder(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Work order berhasil dibuat",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.buatWorkOrder");
      }
    },

    terimaPekerjaan: async (
      _: unknown,
      args: TerimaPekerjaanArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.terimaPekerjaan(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Pekerjaan berhasil diterima",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.terimaPekerjaan");
      }
    },

    ajukanPenolakan: async (
      _: unknown,
      args: AjukanPenolakanArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.ajukanPenolakan(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Penolakan pekerjaan berhasil diajukan",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.ajukanPenolakan");
      }
    },

    reviewPenolakan: async (
      _: unknown,
      args: ReviewPenolakanArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.reviewPenolakan(
          args.input,
          context,
        );
        return {
          success: true,
          message: args.input.disetujui
            ? "Penolakan diterima, work order dibatalkan"
            : "Penolakan ditolak, teknisi wajib menerima pekerjaan",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.reviewPenolakan");
      }
    },

    ajukanTim: async (
      _: unknown,
      args: AjukanTimArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.ajukanTim(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Tim berhasil diajukan",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.ajukanTim");
      }
    },

    kerjaSendiri: async (
      _: unknown,
      args: KerjaSendiriArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.kerjaSendiri(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Berhasil memilih untuk kerja sendiri",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.kerjaSendiri");
      }
    },

    reviewTim: async (
      _: unknown,
      args: ReviewTimArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.reviewTim(
          args.input,
          context,
        );
        return {
          success: true,
          message: args.input.disetujui
            ? "Tim berhasil disetujui"
            : "Tim ditolak",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.reviewTim");
      }
    },

    simpanProgres: async (
      _: unknown,
      args: SimpanProgresArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.simpanProgres(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Progres berhasil disimpan",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.simpanProgres");
      }
    },

    kirimHasil: async (
      _: unknown,
      args: KirimHasilArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.kirimHasil(
          args.input,
          context,
        );
        return {
          success: true,
          message: "Hasil pekerjaan berhasil dikirim untuk direview",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.kirimHasil");
      }
    },

    reviewHasil: async (
      _: unknown,
      args: ReviewHasilArgs,
      context: GraphQLContext,
    ) => {
      try {
        const workOrder = await services.workOrderService.reviewHasil(
          args.input,
          context,
        );
        return {
          success: true,
          message: args.input.disetujui
            ? "Pekerjaan disetujui"
            : "Pekerjaan ditolak, silakan perbaiki",
          workOrder,
        };
      } catch (error) {
        throw handleError(error, "Resolver.reviewHasil");
      }
    },

    batalkanWorkOrder: async (
      _: unknown,
      args: BatalkanWorkOrderArgs,
      context: GraphQLContext,
    ) => {
      try {
        return await services.workOrderService.batalkanWorkOrder(
          args.id,
          args.catatan,
          context,
        );
      } catch (error) {
        throw handleError(error, "Resolver.batalkanWorkOrder");
      }
    },
  },

  // ─── Field Resolvers ─────────────────────────────────────────────────────

  WorkOrder: {
    id: (parent: { _id: { toString(): string } }) => parent._id.toString(),
    idKoneksiData: (parent: { idKoneksiData: any }) =>
      parent.idKoneksiData?.toString() ?? null,
    koneksiData: async (parent: { idKoneksiData: any }) => {
      if (!parent.idKoneksiData) return null;
      try {
        return await DataConnection.findById(parent.idKoneksiData);
      } catch {
        return null;
      }
    },
    workOrderSebelumnya: (parent: { workOrderSebelumnya?: any }) =>
      parent.workOrderSebelumnya ?? null,
    idSurvei: (parent: { idSurvei?: any }) =>
      parent.idSurvei?.toString() ?? null,
    idRAB: (parent: { idRAB?: any }) => parent.idRAB?.toString() ?? null,
    idPemasangan: (parent: { idPemasangan?: any }) =>
      parent.idPemasangan?.toString() ?? null,
    idPengawasanPemasangan: (parent: { idPengawasanPemasangan?: any }) =>
      parent.idPengawasanPemasangan?.toString() ?? null,
    idPengawasanSetelahPemasangan: (parent: {
      idPengawasanSetelahPemasangan?: any;
    }) => parent.idPengawasanSetelahPemasangan?.toString() ?? null,
    idPenyelesaianLaporan: (parent: { idPenyelesaianLaporan?: any }) =>
      parent.idPenyelesaianLaporan?.toString() ?? null,
  },

  KoneksiData: {
    id: (parent: { _id: { toString(): string } }) => parent._id.toString(),
    pelanggan: async (parent: { IdPelanggan?: any }) => {
      if (!parent.IdPelanggan) return null;
      try {
        const db = mongoose.connection.db;
        if (!db) return null;
        const doc = await db
          .collection("penggunas")
          .findOne({ _id: parent.IdPelanggan });
        return doc ?? null;
      } catch {
        return null;
      }
    },
    nik: (parent: { NIK: string }) => parent.NIK,
    noKK: (parent: { NoKK: string }) => parent.NoKK,
    imb: (parent: { IMB: string }) => parent.IMB,
    alamat: (parent: { Alamat: string }) => parent.Alamat,
    kelurahan: (parent: { Kelurahan: string }) => parent.Kelurahan,
    kecamatan: (parent: { Kecamatan: string }) => parent.Kecamatan,
    luasBangunan: (parent: { LuasBangunan: number }) => parent.LuasBangunan,
    statusPengajuan: (parent: { StatusPengajuan: string }) =>
      parent.StatusPengajuan,
    tanggalVerifikasi: (parent: { TanggalVerifikasi?: Date | null }) =>
      parent.TanggalVerifikasi?.toISOString() ?? null,
    alasanPenolakan: (parent: { AlasanPenolakan?: string | null }) =>
      parent.AlasanPenolakan ?? null,
    nikUrl: (parent: { NIKUrl: string }) => parent.NIKUrl,
    kkUrl: (parent: { KKUrl: string }) => parent.KKUrl,
    imbUrl: (parent: { IMBUrl: string }) => parent.IMBUrl,
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },

  Pelanggan: {
    id: (parent: { _id: { toString(): string } }) => parent._id.toString(),
    namaLengkap: (parent: any) =>
      parent.namaLengkap ?? parent.nama ?? parent.fullName ?? "—",
    email: (parent: any) => parent.email ?? "—",
    noHp: (parent: any) => parent.noHp ?? parent.noTelp ?? parent.phone ?? "—",
    alamat: (parent: any) => parent.alamat ?? parent.address ?? null,
  },

  RiwayatReview: {
    tanggal: (parent: { tanggal: Date }) => parent.tanggal.toISOString(),
  },

  RiwayatRespon: {
    tanggal: (parent: { tanggal: Date }) => parent.tanggal.toISOString(),
  },

  ProgresData: {
    koordinat: (parent: {
      koordinat?: { longitude?: any; latitude?: any } | null;
    }) => {
      if (!parent.koordinat) return null;
      const lon = parent.koordinat.longitude;
      const lat = parent.koordinat.latitude;
      if (lon == null || lat == null) return null;
      return { longitude: parseFloat(lon), latitude: parseFloat(lat) };
    },
    urlGambar: (parent: { urlGambar?: any[] | null }) => parent.urlGambar ?? [],
  },
};

export default workOrderResolver;
