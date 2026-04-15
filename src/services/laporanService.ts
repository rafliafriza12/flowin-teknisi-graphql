import mongoose from "mongoose";
import { notFoundError, handleError, validateId } from "../utils/errors";

// ─── Tipe dari schema Laporan ─────────────────────────────────────────────────
// Collection "laporans" — dikelola oleh aplikasi mobile/user, tidak ada
// Mongoose model lokal. Field sesuai schema ERD.

export type JenisLaporan =
  | "AirTidakMengalir"
  | "AirKeruh"
  | "KebocoranPipa"
  | "MeteranBermasalah"
  | "KendalaLainnya";

export type StatusLaporan = "Diajukan" | "ProsesPerbaikan" | "Selesai";

export interface ILaporan {
  _id: mongoose.Types.ObjectId;
  IdPengguna: mongoose.Types.ObjectId;
  NamaLaporan: string;
  Masalah: string;
  Alamat: string;
  ImageURL: string[];
  JenisLaporan: JenisLaporan;
  Catatan?: string | null;
  // Koordinat di laporan adalah ObjectId FK ke collection "geolokasis"
  Koordinat?: mongoose.Types.ObjectId | null;
  Status: StatusLaporan;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKoordinat {
  longitude: number;
  latitude: number;
}

// Data Laporan yang sudah dipopulate semua FK-nya
export interface ILaporanPopulated extends Omit<ILaporan, "Koordinat"> {
  pengguna: {
    _id: mongoose.Types.ObjectId;
    namaLengkap?: string;
    email?: string;
    noHp?: string;
    alamat?: string;
  } | null;
  // Koordinat yang sudah di-resolve dari collection geolokasis
  Koordinat: IKoordinat | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getLaporanCollection = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database belum terkoneksi");
  return db.collection<ILaporan>("laporans");
};

const getPenggunaCollection = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database belum terkoneksi");
  return db.collection("penggunas");
};

const getGeolocationCollection = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database belum terkoneksi");
  return db.collection("geolokasis");
};

// ─── Service ──────────────────────────────────────────────────────────────────

const laporanService = {
  /**
   * Ambil satu laporan berdasarkan ID, sekaligus populate:
   * - IdPengguna  → collection "penggunas"
   * - Kordinat    → collection "geolocations" (by IdLaporan FK)
   */
  getById: async (id: string): Promise<ILaporanPopulated> => {
    try {
      validateId(id, "id");

      const laporanId = new mongoose.Types.ObjectId(id);
      const col = getLaporanCollection();
      const laporan = await col.findOne({ _id: laporanId });

      if (!laporan) {
        throw notFoundError(
          `Laporan dengan ID '${id}' tidak ditemukan`,
          "Laporan",
        );
      }

      // ── Populate pengguna ────────────────────────────────────────────────
      let pengguna: ILaporanPopulated["pengguna"] = null;
      if (laporan.IdPengguna) {
        try {
          const doc = await getPenggunaCollection().findOne({
            _id: laporan.IdPengguna,
          });
          if (doc) {
            pengguna = {
              _id: doc._id as mongoose.Types.ObjectId,
              namaLengkap: doc.namaLengkap ?? doc.nama ?? doc.fullName ?? null,
              email: doc.email ?? null,
              noHp: doc.noHp ?? doc.noTelp ?? doc.phone ?? null,
              alamat: doc.alamat ?? doc.address ?? null,
            };
          }
        } catch {
          // Populate gagal — biarkan null
        }
      }

      // ── Populate koordinat dari collection geolokasis ────────────────────
      // Schema: { IdLaporan(FK ObjectId), Latitude, Longitude }
      let kordinat: IKoordinat | null = null;
      try {
        const geoDoc = await getGeolocationCollection().findOne({
          IdLaporan: laporanId,
        });
        if (geoDoc) {
          const lng = geoDoc.Longitude ?? geoDoc.longitude ?? null;
          const lat = geoDoc.Latitude ?? geoDoc.latitude ?? null;
          if (lng != null && lat != null) {
            kordinat = {
              longitude: parseFloat(lng),
              latitude: parseFloat(lat),
            };
          }
        }
      } catch {
        // Populate gagal — biarkan null
      }

      return { ...laporan, pengguna, Koordinat: kordinat };
    } catch (error) {
      throw handleError(error, "LaporanService.getById");
    }
  },
};

export default laporanService;
