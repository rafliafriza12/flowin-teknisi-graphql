# 📋 Dokumentasi Modul Work Order (Pekerjaan Teknisi)

Dokumen ini menjelaskan **alur bisnis**, **state machine**, **dependensi pekerjaan**, **keamanan signature**, serta **contoh query/mutation** lengkap untuk modul Work Order.

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Arsitektur & File Structure](#2-arsitektur--file-structure)
3. [Enum & Status](#3-enum--status)
4. [Alur Bisnis (State Machine)](#4-alur-bisnis-state-machine)
5. [Dependensi Pekerjaan (Prerequisite)](#5-dependensi-pekerjaan-prerequisite)
6. [Keamanan: Payload Signature](#6-keamanan-payload-signature)
7. [Permission & Role Access](#7-permission--role-access)
8. [GraphQL Schema Reference](#8-graphql-schema-reference)
9. [Query — Contoh & Penjelasan](#9-query--contoh--penjelasan)
10. [Mutation — Contoh & Penjelasan](#10-mutation--contoh--penjelasan)
11. [Error Handling](#11-error-handling)
12. [Catatan & Known Issues](#12-catatan--known-issues)

---

## 1. Gambaran Umum

Modul Work Order mengelola **siklus hidup pekerjaan teknisi** mulai dari penugasan oleh Admin hingga pekerjaan selesai direview. Setiap work order terikat pada satu **Koneksi Data** (pengajuan sambungan pelanggan) dan satu **jenis pekerjaan** tertentu.

### Aktor

| Aktor       | Deskripsi                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ |
| **Admin**   | Membuat work order, mereview tim, mereview hasil, mereview penolakan, membatalkan          |
| **Teknisi** | Menerima/menolak pekerjaan, mengajukan tim, mengerjakan, menyimpan progres, mengirim hasil |

### Konsep Utama

- **1 Work Order = 1 Jenis Pekerjaan** untuk 1 Koneksi Data — setiap tahap pekerjaan adalah **record terpisah**
- Work Order **terhubung secara chain** melalui field `workOrderSebelumnya` — membentuk **rantai workflow (linked-list)**
- Setiap jenis pekerjaan memiliki **dokumen referensi** tersendiri (Survey, RAB, Pemasangan, dll)
- Jenis pekerjaan memiliki **urutan dependensi** — pekerjaan berikutnya hanya bisa dimulai jika sebelumnya sudah selesai
- **Unique constraint**: hanya boleh ada **1 WO aktif per jenis pekerjaan per koneksi data** (partial unique index)
- Semua **mutation** dilindungi oleh **HMAC-SHA256 payload signature**
- **Respon awal teknisi** menjadi **gate utama** — semua aksi lanjutan diblokir sampai teknisi menerima pekerjaan
- **`pekerjaanSekarang`** teknisi baru di-update saat teknisi **menerima** pekerjaan, bukan saat admin assign
- Field `jenisPekerjaan`, `idKoneksiData`, dan `workOrderSebelumnya` bersifat **immutable** setelah WO dibuat

### Pola Workflow Chain

```
❌ SALAH: Satu WO dengan banyak tahap yang berubah-ubah
✅ BENAR: Setiap tahap = WO terpisah, terhubung via chain

KoneksiData "ABC"
├── WO_survei          (workOrderSebelumnya: null)           → selesai ✅
├── WO_rab             (workOrderSebelumnya: WO_survei._id)  → selesai ✅
├── WO_pemasangan      (workOrderSebelumnya: WO_rab._id)     → aktif 🔄
├── WO_pengawasan_...  (belum dibuat — prerequisite belum terpenuhi)
└── WO_penyelesaian    (standalone, workOrderSebelumnya: null)
```

---

## 2. Arsitektur & File Structure

```
src/
├── models/
│   ├── WorkOrder.ts                  # Model utama + enums + hooks
│   ├── DataConnection.ts             # Koneksi Data pelanggan
│   ├── Survey.ts                     # Dokumen survei
│   ├── RAB.ts                        # Dokumen RAB + pembayaran Midtrans
│   ├── Pemasangan.ts                 # Dokumen pemasangan
│   ├── PengawasanPemasangan.ts       # Dokumen pengawasan pemasangan
│   ├── PengawasanSetelahPemasangan.ts# Dokumen pengawasan setelah pemasangan
│   └── PenyelesaianLaporan.ts        # Dokumen penyelesaian laporan
│
├── graphql/
│   ├── typeDefs/workOrder.ts         # GraphQL schema (enums, types, inputs, queries, mutations)
│   └── resolvers/workOrderResolver.ts# Thin resolver → delegates ke service
│
├── services/
│   └── workOrderService.ts           # Business logic (~530 lines)
│
├── utils/
│   └── signatureHash.ts              # HMAC-SHA256 payload verification
│
└── middlewares/
    └── permissions.ts                # Permission mapping untuk semua operasi
```

### Pola Arsitektur

```
Request → Middleware (Auth + Permission) → Resolver (thin) → Service (business logic) → Model (database)
```

---

## 3. Enum & Status

### 3.1 Jenis Pekerjaan (`JenisPekerjaan`)

| Nilai                           | Deskripsi                     | Dokumen Referensi             |
| ------------------------------- | ----------------------------- | ----------------------------- |
| `survei`                        | Survei lapangan               | `Survey` (Survei)             |
| `rab`                           | Rencana Anggaran Biaya        | `RAB`                         |
| `pemasangan`                    | Pemasangan pipa/meteran       | `Pemasangan`                  |
| `pengawasan_pemasangan`         | Pengawasan saat pemasangan    | `PengawasanPemasangan`        |
| `pengawasan_setelah_pemasangan` | Pengawasan setelah pemasangan | `PengawasanSetelahPemasangan` |
| `penyelesaian_laporan`          | Penyelesaian laporan akhir    | `PenyelesaianLaporan`         |

### 3.2 Status Pekerjaan (`StatusPekerjaan`)

| Nilai               | Deskripsi                                      | Siapa yang trigger? |
| ------------------- | ---------------------------------------------- | ------------------- |
| `menunggu_respon`   | Menunggu respon awal teknisi (terima/tolak)    | Auto (saat dibuat)  |
| `menunggu_tim`      | Menunggu teknisi mengajukan tim                | Teknisi (terima WO) |
| `tim_diajukan`      | Tim sudah diajukan, menunggu review admin      | Teknisi             |
| `ditugaskan`        | Tim disetujui / kerja sendiri, siap dikerjakan | Admin / Teknisi     |
| `sedang_dikerjakan` | Teknisi sedang mengerjakan                     | Teknisi             |
| `dikirim`           | Hasil sudah dikirim, menunggu review admin     | Teknisi             |
| `revisi`            | Admin menolak, perlu perbaikan                 | Admin               |
| `selesai`           | Pekerjaan selesai dan disetujui ✅             | Admin               |
| `dibatalkan`        | Pekerjaan dibatalkan ❌                        | Admin               |

> **Status Final:** `selesai` dan `dibatalkan` tidak bisa diubah lagi.

### 3.3 Status Tim (`StatusTim`)

| Nilai            | Deskripsi                                               |
| ---------------- | ------------------------------------------------------- |
| `belum_diajukan` | Teknisi belum mengajukan tim                            |
| `diajukan`       | Tim sudah diajukan, menunggu persetujuan admin          |
| `disetujui`      | Admin menyetujui tim (atau teknisi pilih kerja sendiri) |
| `ditolak`        | Admin menolak tim — teknisi bisa ajukan ulang           |

### 3.4 Status Respon Awal (`StatusRespon`)

| Nilai                | Deskripsi                                            | Siapa yang trigger? |
| -------------------- | ---------------------------------------------------- | ------------------- |
| `belum_direspon`     | Teknisi belum merespon pekerjaan yang diberikan      | Auto (saat dibuat)  |
| `diterima`           | Teknisi menerima pekerjaan → workflow lanjutan aktif | Teknisi             |
| `penolakan_diajukan` | Teknisi mengajukan penolakan, menunggu review admin  | Teknisi             |
| `penolakan_diterima` | Admin menerima penolakan → WO dibatalkan             | Admin               |
| `penolakan_ditolak`  | Admin menolak penolakan → teknisi wajib menerima     | Admin               |

---

## 4. Alur Bisnis (State Machine)

### 4.1 Alur Utama (Happy Path)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ALUR WORK ORDER (dengan Respon Awal)                     │
└─────────────────────────────────────────────────────────────────────────────────┘

  [Admin]                    [Teknisi]                   [Admin]
     │                          │                           │
     │  buatWorkOrder           │                           │
     │─────────────────────────>│                           │
     │                          │                           │
     │                status: menunggu_respon               │
     │                statusRespon: belum_direspon          │
     │                (pekerjaanSekarang BELUM diset)       │
     │                          │                           │
     │               ┌──────────┼──────────┐                │
     │               │                     │                │
     │        terimaPekerjaan      ajukanPenolakan          │
     │               │                     │                │
     │               │                     ▼                │
     │               │          statusRespon:               │
     │               │          penolakan_diajukan          │
     │               │                     │                │
     │               │                     ├────────────────>│
     │               │                     │          reviewPenolakan
     │               │                     │                │
     │               │              ┌──────┼──────┐         │
     │               │              │             │         │
     │               │         disetujui      ditolak       │
     │               │         (terima        (tolak        │
     │               │          penolakan)    penolakan)    │
     │               │              │             │         │
     │               │              ▼             ▼         │
     │               │        dibatalkan ❌  menunggu_respon│
     │               │        statusRespon:  statusRespon:  │
     │               │        penolakan_     penolakan_     │
     │               │        diterima       ditolak        │
     │               │                            │         │
     │               │              terimaPekerjaan (wajib) │
     │               │◄───────────────────────────┘         │
     │               │                                      │
     │               ▼                                      │
     │        statusRespon: diterima                        │
     │        status: menunggu_tim                          │
     │        (pekerjaanSekarang = WO_ID) ← BARU DI SINI   │
     │                          │                           │
     │               ┌──────────┼──────────┐                │
     │               │          │          │                │
     │          ajukanTim   kerjaSendiri   │                │
     │               │          │          │                │
     │               ▼          ▼          │                │
     │         tim_diajukan  ditugaskan    │                │
     │         statusTim:    statusTim:    │                │
     │         diajukan      disetujui     │                │
     │               │                     │                │
     │               ▼                     │                │
     │          reviewTim ◄────────────────┘                │
     │               │                                      │
     │        ┌──────┼──────┐                               │
     │        │             │                               │
     │    disetujui      ditolak                            │
     │    → ditugaskan   → menunggu_tim                     │
     │    statusTim:     statusTim: ditolak                 │
     │    disetujui      (bisa ajukan ulang)                │
     │        │                                             │
     │        ▼                                             │
     │   simpanProgres                                      │
     │   → sedang_dikerjakan                                │
     │        │                                             │
     │        │  (bisa dipanggil berkali-kali)               │
     │        │                                             │
     │        ▼                                             │
     │   kirimHasil                                         │
     │   → dikirim                                          │
     │        │                                             │
     │        └─────────────────────────────────────────────>│
     │                                                      │
     │                                              reviewHasil
     │                                                      │
     │                                           ┌──────────┼──────────┐
     │                                           │                     │
     │                                       disetujui             ditolak
     │                                       → selesai ✅         → revisi
     │                                       (FINAL)              (kembali ke
     │                                       pekerjaanSekarang    simpanProgres/
     │                                       = null               kirimHasil)
```

### 4.2 Alur Respon Awal Teknisi

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RESPON AWAL TEKNISI (Gate Utama)                           │
└──────────────────────────────────────────────────────────────────────────────┘

                         ┌──────────────────┐
                         │  belum_direspon   │ ← status awal
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │                           │
             terimaPekerjaan              ajukanPenolakan
                    │                           │
                    ▼                           ▼
             ┌─────────────┐           ┌────────────────────┐
             │  diterima    │           │ penolakan_diajukan │
             │  ✅ AKTIF    │           │ (menunggu admin)   │
             └─────────────┘           └────────┬───────────┘
                    │                           │
                    │                    reviewPenolakan
              GATE TERBUKA                      │
              (workflow                  ┌──────┼──────┐
              lanjutan                   │             │
              diizinkan)          admin setuju   admin tolak
                                  (terima        (tolak
                                   penolakan)    penolakan)
                                        │             │
                                        ▼             ▼
                                 ┌──────────────┐  ┌────────────────────┐
                                 │ penolakan_   │  │ penolakan_ditolak  │
                                 │ diterima     │  │ (wajib menerima)   │
                                 │ → dibatalkan │  └────────┬───────────┘
                                 └──────────────┘           │
                                                     terimaPekerjaan
                                                     (satu-satunya opsi)
                                                            │
                                                            ▼
                                                     ┌─────────────┐
                                                     │  diterima    │
                                                     │  ✅ AKTIF    │
                                                     └─────────────┘
```

### 4.3 Alur Tim Ditolak (Re-propose)

```
menunggu_tim → [ajukanTim] → tim_diajukan → [reviewTim: tolak] → menunggu_tim
                                                                       │
                                              [ajukanTim ulang] ◄──────┘
                                                     │
                                                     ▼
                                               tim_diajukan → [reviewTim: setuju] → ditugaskan
```

### 4.4 Alur Revisi (Re-submit)

```
dikirim → [reviewHasil: tolak] → revisi → [simpanProgres] → sedang_dikerjakan
                                                                     │
                                                              [kirimHasil]
                                                                     │
                                                                     ▼
                                                                 dikirim → [reviewHasil: setuju] → selesai ✅
```

### 4.5 Alur Pembatalan

```
(status apapun kecuali "selesai") → [Admin: batalkanWorkOrder] → dibatalkan ❌ (FINAL)
```

### 4.6 State Machine Diagram

```
┌───────────────────┐
│  menunggu_respon   │ ← status awal (admin buat WO)
└────────┬──────────┘
         │
         │ terimaPekerjaan (atau: penolakan ditolak → terimaPekerjaan)
         │
         ├──── ajukanPenolakan → reviewPenolakan(setuju) → dibatalkan ❌
         │
         ▼
┌──────────────┐   ajukanTim   ┌───────────────┐   reviewTim    ┌──────────────┐
│ menunggu_tim │──────────────>│ tim_diajukan  │──(ditolak)────>│ menunggu_tim │
│              │               │               │                │              │
│              │               │               │──(disetujui)──>│  ditugaskan  │
│              │──kerjaSendiri─────────────────────────────────>│              │
└──────┬───────┘               └───────────────┘                └──────┬───────┘
       │                                                               │
       │                                                        simpanProgres
       │                                                               │
       │                                                               ▼
       │                                                     ┌──────────────────┐
       │                                                     │ sedang_dikerjakan│
       │                                                     └────────┬─────────┘
       │                                                              │
       │                                                         kirimHasil
       │                                                              │
       │                                                              ▼
       │                                                     ┌──────────────┐
       │           ┌────────────────────(ditolak)────────────│   dikirim    │
       │           │                                         └──────┬───────┘
       │           ▼                                                │
       │    ┌──────────┐                                     reviewHasil
       │    │  revisi   │──simpanProgres──>sedang_dikerjakan (disetujui)
       │    └──────────┘                                            │
       │                                                            ▼
       │                                                     ┌──────────┐
       │                                                     │  selesai  │ ✅ FINAL
       │                                                     └──────────┘
       │
       │  batalkanWorkOrder (dari status apapun kecuali selesai)
       │─────────────────────────────────────────────────────>┌──────────────┐
                                                              │  dibatalkan   │ ❌ FINAL
                                                              └──────────────┘
```

---

## 5. Dependensi Pekerjaan (Prerequisite)

### 5.1 Urutan Dependensi

```
survei ──────> rab ──────> pemasangan ──────> pengawasan_pemasangan ──────> pengawasan_setelah_pemasangan
  │             │              │                       │                              │
  │             │              │                       │                              │
  └─ null       └─ survei      └─ rab                  └─ pemasangan                  └─ pengawasan_pemasangan
  (no prereq)   (harus selesai) (harus selesai          (harus selesai)                (harus selesai)
                                 + RAB settlement)

penyelesaian_laporan ──── null (standalone, tapi DataConnection harus APPROVED)
```

### 5.2 Aturan Validasi Prerequisite

Sebelum membuat work order baru (`buatWorkOrder`), sistem menjalankan `cekPrerequisite`:

| #   | Validasi                                                             | Keterangan                                |
| --- | -------------------------------------------------------------------- | ----------------------------------------- |
| 1   | DataConnection harus **APPROVED**                                    | Status pengajuan koneksi data pelanggan   |
| 2   | Belum ada work order **aktif** untuk jenis yang sama                 | Status selain `dibatalkan` dianggap aktif |
| 3   | Work order **prerequisite** harus **selesai**                        | Sesuai peta `URUTAN_PEKERJAAN`            |
| 4   | **Khusus pemasangan:** RAB harus `statusPembayaran === "settlement"` | Pembayaran via Midtrans harus lunas       |

### 5.3 Contoh Skenario

```
Koneksi Data: KD-001 (APPROVED)

✅ Buat WO survei         → langsung bisa (prereq: null)
❌ Buat WO rab            → GAGAL (WO survei belum selesai)
✅ [WO survei selesai]
✅ Buat WO rab            → sekarang bisa (prereq survei: selesai ✅)
❌ Buat WO pemasangan     → GAGAL (WO rab belum selesai + pembayaran belum settlement)
✅ [WO rab selesai + RAB settlement]
✅ Buat WO pemasangan     → sekarang bisa
```

---

## 6. Keamanan: Payload Signature

Semua **mutation** dilindungi oleh verifikasi **HMAC-SHA256 payload signature** untuk mencegah payload tampering.

### 6.1 Alur Signature

```
┌──────────────────────────────────────────────────────────────────────┐
│ CLIENT                                                               │
│                                                                      │
│  1. Siapkan payload (input mutation)                                 │
│  2. Sort keys rekursif → canonical JSON string                       │
│  3. HMAC-SHA256(canonical, INTERNAL_API_SECRET)                      │
│  4. Kirim hash di header x-signature                                 │
│                                                                      │
│  Request:                                                            │
│    Header: x-api-key: <API_KEY>                                      │
│    Header: Authorization: Bearer <accessToken>                       │
│    Header: x-signature: <hmac_sha256_hex>                            │
│    Body: { query: "mutation { ... }", variables: { input: {...} } }   │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ SERVER                                                               │
│                                                                      │
│  1. Ambil header x-signature                                         │
│  2. Ambil payload (input dari resolver args)                         │
│  3. Sort keys rekursif → canonical JSON string                       │
│  4. HMAC-SHA256(canonical, INTERNAL_API_SECRET)                      │
│  5. timingSafeEqual(client_hash, server_hash)                        │
│     ├── Cocok ✅ → lanjut ke business logic                          │
│     └── Tidak cocok ❌ → throw "Signature payload tidak valid"       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Cara Generate Signature (Pseudocode)

```javascript
const crypto = require("crypto");

// 1. Payload mutation
const input = {
  idKoneksiData: "6615abc123def456...",
  jenisPekerjaan: "survei",
  teknisiPenanggungJawab: "6615def789abc012...",
};

// 2. Canonical: sort keys rekursif → stringify
function canonicalize(obj) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";

  const sorted = Object.keys(obj).sort();
  const entries = sorted.map(
    (k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`,
  );
  return "{" + entries.join(",") + "}";
}

// 3. HMAC-SHA256
const canonical = canonicalize(input);
// → '{"idKoneksiData":"6615abc123def456...","jenisPekerjaan":"survei","teknisiPenanggungJawab":"6615def789abc012..."}'

const signature = crypto
  .createHmac("sha256", INTERNAL_API_SECRET)
  .update(canonical)
  .digest("hex");

// 4. Kirim di header
// x-signature: a3f8b2c1d4e5f6...
```

### 6.3 Mutation yang Memerlukan Signature

| Mutation          | Payload yang di-hash   |
| ----------------- | ---------------------- |
| `buatWorkOrder`   | `BuatWorkOrderInput`   |
| `terimaPekerjaan` | `TerimaPekerjaanInput` |
| `ajukanPenolakan` | `AjukanPenolakanInput` |
| `reviewPenolakan` | `ReviewPenolakanInput` |
| `ajukanTim`       | `AjukanTimInput`       |
| `kerjaSendiri`    | `KerjaSendiriInput`    |
| `reviewTim`       | `ReviewTimInput`       |
| `simpanProgres`   | `SimpanProgresInput`   |
| `kirimHasil`      | `KirimHasilInput`      |
| `reviewHasil`     | `ReviewHasilInput`     |

> **Catatan:** `batalkanWorkOrder` tidak menggunakan input object sehingga tidak memerlukan signature.

---

## 7. Permission & Role Access

### 7.1 Query Permissions

| Operasi                    | Role yang Diizinkan   | Deskripsi                                     |
| -------------------------- | --------------------- | --------------------------------------------- |
| `workOrders`               | `Admin`               | List semua work order (+ filter + pagination) |
| `workOrder`                | `Admin`, `Technician` | Detail satu work order by ID                  |
| `workOrdersSaya`           | `Technician`          | Work order milik teknisi yang login           |
| `workOrdersByKoneksiData`  | `Admin`, `Technician` | Semua WO untuk satu koneksi data              |
| `workflowChain`            | `Admin`, `Technician` | Rantai workflow lengkap per koneksi data      |
| `cekPrerequisitePekerjaan` | `Admin`               | Cek apakah jenis pekerjaan bisa dibuat        |

### 7.2 Mutation Permissions

| Operasi             | Role         | Deskripsi                       |
| ------------------- | ------------ | ------------------------------- |
| `buatWorkOrder`     | `Admin`      | Buat WO baru + tugaskan teknisi |
| `reviewTim`         | `Admin`      | Setujui/tolak pengajuan tim     |
| `reviewHasil`       | `Admin`      | Setujui/tolak hasil pekerjaan   |
| `reviewPenolakan`   | `Admin`      | Setujui/tolak penolakan teknisi |
| `batalkanWorkOrder` | `Admin`      | Batalkan WO                     |
| `terimaPekerjaan`   | `Technician` | Terima pekerjaan (gate utama)   |
| `ajukanPenolakan`   | `Technician` | Ajukan penolakan pekerjaan      |
| `ajukanTim`         | `Technician` | Ajukan anggota tim              |
| `kerjaSendiri`      | `Technician` | Pilih bekerja tanpa tim         |
| `simpanProgres`     | `Technician` | Simpan progres (draft)          |
| `kirimHasil`        | `Technician` | Kirim hasil untuk direview      |

---

## 8. GraphQL Schema Reference

### 8.1 Types

```graphql
type WorkOrder {
  id: ID!
  idKoneksiData: ID!
  jenisPekerjaan: JenisPekerjaan!
  teknisiPenanggungJawab: User! # Populated
  tim: [User!]! # Populated
  statusTim: StatusTim!
  catatanTim: String
  status: StatusPekerjaan!
  # ─── Workflow Chain ─────────────────────────────────────
  workOrderSebelumnya: WorkOrder # Populated — null jika pekerjaan pertama
  # ─── Respon Awal ────────────────────────────────────────
  statusRespon: StatusRespon!
  alasanPenolakan: String
  catatanReviewPenolakan: String
  riwayatRespon: [RiwayatRespon!]!
  # ─── Referensi Dokumen ──────────────────────────────────
  idSurvei: ID
  idRAB: ID
  idPemasangan: ID
  idPengawasanPemasangan: ID
  idPengawasanSetelahPemasangan: ID
  idPenyelesaianLaporan: ID
  # ─── Review ─────────────────────────────────────────────
  catatanReview: String
  riwayatReview: [RiwayatReview!]!
  createdAt: String!
  updatedAt: String!
}

type RiwayatReview {
  status: String! # "disetujui" | "ditolak"
  catatan: String
  oleh: User! # Populated — admin yang mereview
  tanggal: String! # ISO 8601 datetime
}

# Ringkasan satu tahap dalam rantai workflow
type WorkflowChainItem {
  jenisPekerjaan: JenisPekerjaan!
  workOrder: WorkOrder # null jika belum dibuat
  chainStatus: String! # "selesai" | "aktif" | "dibatalkan" | "belum_dibuat"
  urutan: Int! # Urutan dalam rantai (1-based)
  bisaDibuat: Boolean! # Apakah prerequisite terpenuhi untuk membuat WO baru
}

type WorkOrderListResponse {
  data: [WorkOrder!]!
  pagination: PageInfo!
}

type WorkOrderMutationResponse {
  success: Boolean!
  message: String!
  workOrder: WorkOrder!
}

type BatalkanWorkOrderResponse {
  success: Boolean!
  message: String!
}
```

### 8.2 Inputs

```graphql
input BuatWorkOrderInput {
  idKoneksiData: ID!
  jenisPekerjaan: JenisPekerjaan!
  teknisiPenanggungJawab: ID!
}

input TerimaPekerjaanInput {
  workOrderId: ID!
}

input AjukanPenolakanInput {
  workOrderId: ID!
  alasan: String! # Min 10 karakter
}

input ReviewPenolakanInput {
  workOrderId: ID!
  disetujui: Boolean!
  catatan: String # Wajib jika ditolak (min 10 karakter)
}

input AjukanTimInput {
  workOrderId: ID!
  anggotaTim: [ID!]!
}

input KerjaSendiriInput {
  workOrderId: ID!
}

input ReviewTimInput {
  workOrderId: ID!
  disetujui: Boolean!
  catatan: String # Wajib jika ditolak (min 10 karakter)
}

input SimpanProgresInput {
  workOrderId: ID!
  data: String! # JSON string berisi field dokumen referensi
}

input KirimHasilInput {
  workOrderId: ID!
}

input ReviewHasilInput {
  workOrderId: ID!
  disetujui: Boolean!
  catatan: String # Wajib jika ditolak (min 10 karakter)
}

input WorkOrderFilterInput {
  status: StatusPekerjaan
  jenisPekerjaan: JenisPekerjaan
  statusTim: StatusTim
  statusRespon: StatusRespon
  teknisiPenanggungJawab: ID
  idKoneksiData: ID
}

input PaginationInput {
  page: Int # Default: 1
  limit: Int # Default: 20
}
```

---

## 9. Query — Contoh & Penjelasan

### 9.1 `workOrders` — List Semua Work Order _(Admin)_

Mengambil semua work order dengan filter dan pagination.

```graphql
query DaftarWorkOrder(
  $filter: WorkOrderFilterInput
  $pagination: PaginationInput
) {
  workOrders(filter: $filter, pagination: $pagination) {
    data {
      id
      jenisPekerjaan
      status
      statusTim
      teknisiPenanggungJawab {
        namaLengkap
        nip
        divisi
      }
      tim {
        namaLengkap
        nip
      }
      createdAt
      updatedAt
    }
    pagination {
      total
      page
      limit
      totalPages
      hasNextPage
      hasPrevPage
    }
  }
}
```

**Variables:**

```json
{
  "filter": {
    "status": "menunggu_tim",
    "jenisPekerjaan": "survei"
  },
  "pagination": {
    "page": 1,
    "limit": 10
  }
}
```

**Headers:**

```
x-api-key: <INTERNAL_API_SECRET>
Authorization: Bearer <admin_access_token>
```

---

### 9.2 `workOrder` — Detail Work Order _(Admin, Technician)_

Mengambil detail satu work order berdasarkan ID, termasuk riwayat review.

```graphql
query DetailWorkOrder($id: ID!) {
  workOrder(id: $id) {
    id
    idKoneksiData
    jenisPekerjaan
    status
    statusTim
    catatanTim
    catatanReview
    teknisiPenanggungJawab {
      namaLengkap
      nip
      email
      noHp
      divisi
    }
    tim {
      namaLengkap
      nip
      divisi
    }
    idSurvei
    idRAB
    idPemasangan
    idPengawasanPemasangan
    idPengawasanSetelahPemasangan
    idPenyelesaianLaporan
    riwayatReview {
      status
      catatan
      oleh {
        namaLengkap
      }
      tanggal
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**

```json
{
  "id": "6615abc123def456789abcde"
}
```

---

### 9.3 `workOrdersSaya` — Work Order Milik Saya _(Technician)_

Mengambil work order dimana teknisi adalah penanggung jawab **atau** anggota tim.

```graphql
query WorkOrderSaya(
  $filter: WorkOrderFilterInput
  $pagination: PaginationInput
) {
  workOrdersSaya(filter: $filter, pagination: $pagination) {
    data {
      id
      jenisPekerjaan
      status
      statusTim
      catatanTim
      catatanReview
      teknisiPenanggungJawab {
        namaLengkap
      }
      tim {
        namaLengkap
      }
      createdAt
    }
    pagination {
      total
      page
      limit
      totalPages
      hasNextPage
      hasPrevPage
    }
  }
}
```

**Variables:**

```json
{
  "filter": {
    "status": "sedang_dikerjakan"
  },
  "pagination": {
    "page": 1,
    "limit": 10
  }
}
```

**Headers:**

```
x-api-key: <INTERNAL_API_SECRET>
Authorization: Bearer <technician_access_token>
```

---

### 9.4 `workOrdersByKoneksiData` — WO per Koneksi Data _(Admin, Technician)_

Mengambil semua work order untuk satu koneksi data (urut berdasarkan `createdAt` ascending).

```graphql
query WorkOrderKoneksiData($idKoneksiData: ID!) {
  workOrdersByKoneksiData(idKoneksiData: $idKoneksiData) {
    id
    jenisPekerjaan
    status
    statusTim
    teknisiPenanggungJawab {
      namaLengkap
    }
    createdAt
  }
}
```

**Variables:**

```json
{
  "idKoneksiData": "6615def789abc012345def01"
}
```

---

### 9.5 `workflowChain` — Rantai Workflow Lengkap _(Admin, Technician)_

Mengambil seluruh rantai workflow untuk satu koneksi data. Menampilkan semua tahap pekerjaan beserta status masing-masing (selesai, aktif, belum dibuat, dibatalkan) dan apakah tahap tersebut bisa dibuat sekarang.

```graphql
query WorkflowChain($idKoneksiData: ID!) {
  workflowChain(idKoneksiData: $idKoneksiData) {
    jenisPekerjaan
    chainStatus
    urutan
    bisaDibuat
    workOrder {
      id
      status
      statusRespon
      teknisiPenanggungJawab {
        namaLengkap
      }
      workOrderSebelumnya {
        id
        jenisPekerjaan
        status
      }
      createdAt
    }
  }
}
```

**Variables:**

```json
{
  "idKoneksiData": "6615def789abc012345def01"
}
```

**Response (sebagian tahap sudah selesai):**

```json
{
  "data": {
    "workflowChain": [
      {
        "jenisPekerjaan": "survei",
        "chainStatus": "selesai",
        "urutan": 1,
        "bisaDibuat": false,
        "workOrder": {
          "id": "wo_survei_id",
          "status": "selesai",
          "statusRespon": "diterima",
          "teknisiPenanggungJawab": { "namaLengkap": "Budi" },
          "workOrderSebelumnya": null,
          "createdAt": "2026-04-01T10:00:00.000Z"
        }
      },
      {
        "jenisPekerjaan": "rab",
        "chainStatus": "aktif",
        "urutan": 2,
        "bisaDibuat": false,
        "workOrder": {
          "id": "wo_rab_id",
          "status": "sedang_dikerjakan",
          "statusRespon": "diterima",
          "teknisiPenanggungJawab": { "namaLengkap": "Andi" },
          "workOrderSebelumnya": {
            "id": "wo_survei_id",
            "jenisPekerjaan": "survei",
            "status": "selesai"
          },
          "createdAt": "2026-04-02T08:00:00.000Z"
        }
      },
      {
        "jenisPekerjaan": "pemasangan",
        "chainStatus": "belum_dibuat",
        "urutan": 3,
        "bisaDibuat": false,
        "workOrder": null
      },
      {
        "jenisPekerjaan": "pengawasan_pemasangan",
        "chainStatus": "belum_dibuat",
        "urutan": 4,
        "bisaDibuat": false,
        "workOrder": null
      },
      {
        "jenisPekerjaan": "pengawasan_setelah_pemasangan",
        "chainStatus": "belum_dibuat",
        "urutan": 5,
        "bisaDibuat": false,
        "workOrder": null
      },
      {
        "jenisPekerjaan": "penyelesaian_laporan",
        "chainStatus": "belum_dibuat",
        "urutan": 6,
        "bisaDibuat": false,
        "workOrder": null
      }
    ]
  }
}
```

---

### 9.6 `cekPrerequisitePekerjaan` — Cek Prasyarat _(Admin)_

Mengecek apakah jenis pekerjaan tertentu bisa dibuat untuk suatu koneksi data. Return `true` jika semua prasyarat terpenuhi.

```graphql
query CekPrerequisite($idKoneksiData: ID!, $jenisPekerjaan: JenisPekerjaan!) {
  cekPrerequisitePekerjaan(
    idKoneksiData: $idKoneksiData
    jenisPekerjaan: $jenisPekerjaan
  )
}
```

**Variables:**

```json
{
  "idKoneksiData": "6615def789abc012345def01",
  "jenisPekerjaan": "rab"
}
```

**Response (prerequisite terpenuhi):**

```json
{
  "data": {
    "cekPrerequisitePekerjaan": true
  }
}
```

**Response (prerequisite belum terpenuhi):**

```json
{
  "data": {
    "cekPrerequisitePekerjaan": false
  }
}
```

---

## 10. Mutation — Contoh & Penjelasan

> ⚠️ **Semua mutation memerlukan header `x-signature`** (kecuali `batalkanWorkOrder`).
> Lihat [Bagian 6: Keamanan Payload Signature](#6-keamanan-payload-signature) untuk cara generate.

### 10.1 `buatWorkOrder` — Buat Work Order Baru _(Admin)_

Admin membuat work order dan menugaskan teknisi penanggung jawab. Work order dibuat dengan status `menunggu_respon` — teknisi harus merespon (menerima/menolak) sebelum workflow lanjutan bisa berjalan.

**Validasi yang dijalankan:**

1. ✅ Prerequisite pekerjaan terpenuhi
2. ✅ Teknisi ada dan aktif (`isActive: true`)
3. ✅ Teknisi tidak sedang mengerjakan pekerjaan lain (`pekerjaanSekarang === null`)
4. ✅ Payload signature valid

**Efek samping:**

- ⚠️ `User.pekerjaanSekarang` **BELUM** di-update di sini (baru di-update saat teknisi menerima pekerjaan)

```graphql
mutation BuatWorkOrder($input: BuatWorkOrderInput!) {
  buatWorkOrder(input: $input) {
    success
    message
    workOrder {
      id
      jenisPekerjaan
      status
      statusRespon
      statusTim
      teknisiPenanggungJawab {
        namaLengkap
        nip
      }
      createdAt
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "idKoneksiData": "6615def789abc012345def01",
    "jenisPekerjaan": "survei",
    "teknisiPenanggungJawab": "6615abc123def456789abcde"
  }
}
```

**Headers:**

```
x-api-key: <INTERNAL_API_SECRET>
Authorization: Bearer <admin_access_token>
x-signature: <hmac_sha256_of_input>
```

**Response sukses:**

```json
{
  "data": {
    "buatWorkOrder": {
      "success": true,
      "message": "Work order berhasil dibuat",
      "workOrder": {
        "id": "6625aaa111bbb222ccc333dd",
        "jenisPekerjaan": "survei",
        "status": "menunggu_respon",
        "statusRespon": "belum_direspon",
        "statusTim": "belum_diajukan",
        "teknisiPenanggungJawab": {
          "namaLengkap": "Budi Santoso",
          "nip": "12345678"
        },
        "createdAt": "2026-04-04T10:30:00.000Z"
      }
    }
  }
}
```

---

### 10.2 `terimaPekerjaan` — Terima Pekerjaan _(Technician)_

Teknisi menerima pekerjaan yang ditugaskan. **Ini adalah gate utama** — semua aksi lanjutan (ajukan tim, kerja sendiri, simpan progres, dll) diblokir sampai pekerjaan diterima.

**Kondisi:**

- statusRespon harus `belum_direspon` ATAU `penolakan_ditolak` (jika penolakan sebelumnya ditolak admin)
- Hanya penanggung jawab
- Teknisi tidak sedang mengerjakan pekerjaan lain

**Efek samping:**

- `statusRespon` → `diterima`
- `status` → `menunggu_tim`
- `User.pekerjaanSekarang` penanggung jawab di-update ke ID work order
- Riwayat respon ditambahkan

```graphql
mutation TerimaPekerjaan($input: TerimaPekerjaanInput!) {
  terimaPekerjaan(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusRespon
      riwayatRespon {
        aksi
        oleh {
          namaLengkap
        }
        tanggal
      }
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd"
  }
}
```

**Response sukses:**

```json
{
  "data": {
    "terimaPekerjaan": {
      "success": true,
      "message": "Pekerjaan berhasil diterima",
      "workOrder": {
        "id": "6625aaa111bbb222ccc333dd",
        "status": "menunggu_tim",
        "statusRespon": "diterima",
        "riwayatRespon": [
          {
            "aksi": "diterima",
            "oleh": { "namaLengkap": "Budi Santoso" },
            "tanggal": "2026-04-04T11:00:00.000Z"
          }
        ]
      }
    }
  }
}
```

---

### 10.3 `ajukanPenolakan` — Ajukan Penolakan Pekerjaan _(Technician)_

Teknisi mengajukan penolakan terhadap pekerjaan yang ditugaskan. Penolakan harus direview admin.

**Kondisi:**

- statusRespon harus `belum_direspon` (tidak bisa menolak jika sudah diterima atau sudah pernah menolak)
- Hanya penanggung jawab
- Alasan minimal 10 karakter

**Efek samping:**

- `statusRespon` → `penolakan_diajukan`
- `alasanPenolakan` diisi
- Riwayat respon ditambahkan

```graphql
mutation AjukanPenolakan($input: AjukanPenolakanInput!) {
  ajukanPenolakan(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusRespon
      alasanPenolakan
      riwayatRespon {
        aksi
        alasan
        oleh {
          namaLengkap
        }
        tanggal
      }
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "alasan": "Lokasi terlalu jauh dari area kerja saya dan jadwal bentrok dengan pekerjaan lain"
  }
}
```

**Response sukses:**

```json
{
  "data": {
    "ajukanPenolakan": {
      "success": true,
      "message": "Penolakan pekerjaan berhasil diajukan",
      "workOrder": {
        "id": "6625aaa111bbb222ccc333dd",
        "status": "menunggu_respon",
        "statusRespon": "penolakan_diajukan",
        "alasanPenolakan": "Lokasi terlalu jauh dari area kerja saya dan jadwal bentrok dengan pekerjaan lain",
        "riwayatRespon": [
          {
            "aksi": "penolakan_diajukan",
            "alasan": "Lokasi terlalu jauh dari area kerja saya dan jadwal bentrok dengan pekerjaan lain",
            "oleh": { "namaLengkap": "Budi Santoso" },
            "tanggal": "2026-04-04T11:00:00.000Z"
          }
        ]
      }
    }
  }
}
```

---

### 10.4 `reviewPenolakan` — Review Penolakan Teknisi _(Admin)_

Admin mereview penolakan yang diajukan teknisi.

**Jika `disetujui: true`** (admin menerima penolakan):

- `statusRespon` → `penolakan_diterima`
- `status` → `dibatalkan`
- Work order selesai, riwayat tetap tersimpan
- `pekerjaanSekarang` tidak perlu direset (belum pernah di-set)

**Jika `disetujui: false`** (admin menolak penolakan):

- `statusRespon` → `penolakan_ditolak`
- `status` tetap `menunggu_respon`
- Catatan wajib diisi (min 10 karakter)
- Teknisi **wajib menerima** pekerjaan via `terimaPekerjaan`

```graphql
mutation ReviewPenolakan($input: ReviewPenolakanInput!) {
  reviewPenolakan(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusRespon
      catatanReviewPenolakan
      riwayatRespon {
        aksi
        alasan
        oleh {
          namaLengkap
        }
        tanggal
      }
    }
  }
}
```

**Variables (tolak penolakan):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "disetujui": false,
    "catatan": "Area ini masih dalam jangkauan kerja Anda. Silakan koordinasi dengan kepala teknik."
  }
}
```

**Response (tolak penolakan):**

```json
{
  "data": {
    "reviewPenolakan": {
      "success": true,
      "message": "Penolakan ditolak, teknisi wajib menerima pekerjaan",
      "workOrder": {
        "id": "6625aaa111bbb222ccc333dd",
        "status": "menunggu_respon",
        "statusRespon": "penolakan_ditolak",
        "catatanReviewPenolakan": "Area ini masih dalam jangkauan kerja Anda. Silakan koordinasi dengan kepala teknik.",
        "riwayatRespon": [
          {
            "aksi": "penolakan_diajukan",
            "alasan": "Lokasi terlalu jauh",
            "oleh": { "namaLengkap": "Budi Santoso" },
            "tanggal": "2026-04-04T11:00:00.000Z"
          },
          {
            "aksi": "penolakan_ditolak",
            "alasan": "Area ini masih dalam jangkauan kerja Anda. Silakan koordinasi dengan kepala teknik.",
            "oleh": { "namaLengkap": "Admin PERUMDAM" },
            "tanggal": "2026-04-04T12:00:00.000Z"
          }
        ]
      }
    }
  }
}
```

---

### 10.5 `ajukanTim` — Ajukan Anggota Tim _(Technician)_

Teknisi penanggung jawab mengajukan anggota tim untuk mengerjakan work order bersama.

> ⚠️ **Gate:** Pekerjaan harus sudah diterima (`statusRespon === "diterima"`) sebelum aksi ini bisa dilakukan.

**Validasi yang dijalankan:**

1. ✅ Hanya penanggung jawab yang bisa mengajukan
2. ✅ Pekerjaan sudah diterima (`statusRespon: diterima`)
3. ✅ Status: `menunggu_tim` atau `ditugaskan`
4. ✅ StatusTim: `belum_diajukan` atau `ditolak`
5. ✅ Minimal 1 anggota tim
6. ✅ Penanggung jawab tidak boleh ada dalam daftar anggota
7. ✅ Semua anggota harus user aktif
8. ✅ Semua anggota tim tidak sedang mengerjakan pekerjaan lain (`pekerjaanSekarang === null` atau WO yang sama)
9. ✅ Payload signature valid

```graphql
mutation AjukanTim($input: AjukanTimInput!) {
  ajukanTim(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusTim
      tim {
        namaLengkap
        nip
      }
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "anggotaTim": ["6615bbb222ccc333ddd444ee", "6615ccc333ddd444eee555ff"]
  }
}
```

**Response sukses:**

```json
{
  "data": {
    "ajukanTim": {
      "success": true,
      "message": "Tim berhasil diajukan",
      "workOrder": {
        "id": "6625aaa111bbb222ccc333dd",
        "status": "tim_diajukan",
        "statusTim": "diajukan",
        "tim": [
          { "namaLengkap": "Agus Setiawan", "nip": "23456789" },
          { "namaLengkap": "Dedi Kurniawan", "nip": "34567890" }
        ]
      }
    }
  }
}
```

---

### 10.6 `kerjaSendiri` — Kerja Tanpa Tim _(Technician)_

Teknisi memilih untuk bekerja sendiri tanpa anggota tim tambahan.

> ⚠️ **Gate:** Pekerjaan harus sudah diterima (`statusRespon === "diterima"`) sebelum aksi ini bisa dilakukan.

**Validasi yang dijalankan:**

1. ✅ Hanya penanggung jawab
2. ✅ Pekerjaan sudah diterima (`statusRespon: diterima`)
3. ✅ Status: `menunggu_tim`
4. ✅ StatusTim: `belum_diajukan` atau `ditolak`

**Efek:**

- `tim` dikosongkan
- `statusTim` → `disetujui`
- `status` → `ditugaskan` (langsung bisa mulai kerja)

```graphql
mutation KerjaSendiri($input: KerjaSendiriInput!) {
  kerjaSendiri(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusTim
      tim {
        namaLengkap
      }
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd"
  }
}
```

---

### 10.7 `reviewTim` — Review Pengajuan Tim _(Admin)_

Admin menyetujui atau menolak pengajuan tim dari teknisi.

**Validasi yang dijalankan:**

1. ✅ StatusTim harus `diajukan`
2. ✅ Work order bukan status final
3. ✅ Jika ditolak: catatan wajib diisi (min 10 karakter)

```graphql
mutation ReviewTim($input: ReviewTimInput!) {
  reviewTim(input: $input) {
    success
    message
    workOrder {
      id
      status
      statusTim
      catatanTim
      tim {
        namaLengkap
        nip
      }
    }
  }
}
```

**Variables (Setujui):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "disetujui": true
  }
}
```

**Variables (Tolak):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "disetujui": false,
    "catatan": "Anggota tim terlalu banyak, cukup 2 orang saja untuk pekerjaan survei"
  }
}
```

**Efek jika disetujui:**
| Field | Nilai |
|---|---|
| `status` | `ditugaskan` |
| `statusTim` | `disetujui` |
| `catatanTim` | `null` (dibersihkan) |
| `User.pekerjaanSekarang` (semua anggota tim) | ID work order ini |

**Efek jika ditolak:**
| Field | Nilai |
|---|---|
| `status` | `menunggu_tim` |
| `statusTim` | `ditolak` |
| `catatanTim` | catatan penolakan |
| `tim` | `[]` (dikosongkan) |

---

### 10.8 `simpanProgres` — Simpan Progres Pekerjaan _(Technician)_

Teknisi menyimpan data pekerjaan (draft). Data dikirim sebagai **JSON string** sesuai field model dokumen referensi.

> ⚠️ **Gate:** Pekerjaan harus sudah diterima (`statusRespon === "diterima"`) sebelum aksi ini bisa dilakukan.

**Validasi yang dijalankan:**

1. ✅ Hanya penanggung jawab
2. ✅ Pekerjaan sudah diterima (`statusRespon: diterima`)
3. ✅ Status: `ditugaskan`, `sedang_dikerjakan`, atau `revisi`
4. ✅ Tim harus sudah `disetujui`
5. ✅ Format `data` harus valid JSON

**Perilaku:**

- Jika dokumen referensi **belum ada** → create baru + link ke work order
- Jika dokumen referensi **sudah ada** → update existing
- Status otomatis menjadi `sedang_dikerjakan`

```graphql
mutation SimpanProgres($input: SimpanProgresInput!) {
  simpanProgres(input: $input) {
    success
    message
    workOrder {
      id
      status
      idSurvei
      idRAB
      idPemasangan
    }
  }
}
```

**Variables (Contoh: Survei):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "data": "{\"koordinat\":{\"longitude\":112.7521,\"latitude\":-7.2575},\"urlJaringan\":\"https://cloudinary.com/foto-jaringan.jpg\",\"diameterPipa\":25,\"posisiMeteran\":\"depan rumah\",\"jumlahPenghuni\":5,\"standar\":true,\"catatan\":\"Akses jalan cukup lebar\"}"
  }
}
```

**Variables (Contoh: RAB):**

```json
{
  "input": {
    "workOrderId": "6625bbb222ccc333ddd444ee",
    "data": "{\"totalBiaya\":2500000,\"urlRab\":\"https://cloudinary.com/dokumen-rab.pdf\",\"catatan\":\"Biaya termasuk material dan jasa\"}"
  }
}
```

**Variables (Contoh: Pemasangan):**

```json
{
  "input": {
    "workOrderId": "6625ccc333ddd444eee555ff",
    "data": "{\"seriMeteran\":\"MTR-2026-001\",\"fotoRumah\":\"https://cloudinary.com/foto-rumah.jpg\",\"fotoMeteran\":\"https://cloudinary.com/foto-meteran.jpg\",\"fotoMeteranDanRumah\":\"https://cloudinary.com/foto-meteran-rumah.jpg\",\"catatan\":\"Pemasangan selesai tanpa kendala\"}"
  }
}
```

**Variables (Contoh: Pengawasan Pemasangan):**

```json
{
  "input": {
    "workOrderId": "6625ddd444eee555fff666aa",
    "data": "{\"urlGambar\":[\"https://cloudinary.com/pengawasan-1.jpg\",\"https://cloudinary.com/pengawasan-2.jpg\"],\"catatan\":\"Pemasangan sesuai standar\"}"
  }
}
```

> **📌 Penting:** Field `idKoneksiData` (untuk survei/rab/pemasangan) dan `idPemasangan` (untuk pengawasan) akan **otomatis di-set** oleh server. Client tidak perlu mengirimkan field tersebut.

---

### 10.9 `kirimHasil` — Kirim Hasil untuk Review _(Technician)_

Teknisi mengirim hasil pekerjaan agar bisa direview admin.

> ⚠️ **Gate:** Pekerjaan harus sudah diterima (`statusRespon === "diterima"`) sebelum aksi ini bisa dilakukan.

**Validasi yang dijalankan:**

1. ✅ Hanya penanggung jawab
2. ✅ Pekerjaan sudah diterima (`statusRespon: diterima`)
3. ✅ Status: `sedang_dikerjakan` atau `revisi`
4. ✅ Dokumen referensi harus sudah ada (harus `simpanProgres` dulu)

**Efek:**

- `status` → `dikirim`
- `catatanReview` → `null` (dibersihkan)

```graphql
mutation KirimHasil($input: KirimHasilInput!) {
  kirimHasil(input: $input) {
    success
    message
    workOrder {
      id
      status
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd"
  }
}
```

---

### 10.10 `reviewHasil` — Review Hasil Pekerjaan _(Admin)_

Admin mereview hasil pekerjaan yang dikirim teknisi.

**Validasi yang dijalankan:**

1. ✅ Status harus `dikirim`
2. ✅ Work order bukan status final
3. ✅ Jika ditolak: catatan wajib diisi (min 10 karakter)

**Efek samping:**

- Menambah entry ke `riwayatReview[]`
- Jika **disetujui**: `User.pekerjaanSekarang` di-set `null` untuk **penanggung jawab + semua anggota tim**

```graphql
mutation ReviewHasil($input: ReviewHasilInput!) {
  reviewHasil(input: $input) {
    success
    message
    workOrder {
      id
      status
      catatanReview
      riwayatReview {
        status
        catatan
        oleh {
          namaLengkap
        }
        tanggal
      }
    }
  }
}
```

**Variables (Setujui):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "disetujui": true,
    "catatan": "Hasil survei lengkap dan sesuai standar"
  }
}
```

**Variables (Tolak):**

```json
{
  "input": {
    "workOrderId": "6625aaa111bbb222ccc333dd",
    "disetujui": false,
    "catatan": "Foto meteran tidak jelas, mohon foto ulang dari jarak dekat dengan pencahayaan yang baik"
  }
}
```

**Efek jika disetujui:**
| Field | Nilai |
|---|---|
| `status` | `selesai` (FINAL) |
| `catatanReview` | `null` |
| `User.pekerjaanSekarang` (penanggung jawab + semua anggota tim) | `null` |

**Efek jika ditolak:**
| Field | Nilai |
|---|---|
| `status` | `revisi` |
| `catatanReview` | catatan penolakan |

---

### 10.11 `batalkanWorkOrder` — Batalkan Work Order _(Admin)_

Admin membatalkan work order. Tidak memerlukan `x-signature`.

**Validasi yang dijalankan:**

1. ✅ Status bukan `selesai`
2. ✅ Status bukan `dibatalkan` (sudah dibatalkan sebelumnya)

**Efek samping:**

- `User.pekerjaanSekarang` di-set `null` untuk **penanggung jawab + semua anggota tim** — **hanya jika `statusRespon === "diterima"`** (karena jika belum diterima, `pekerjaanSekarang` belum pernah di-set)

```graphql
mutation BatalkanWorkOrder($id: ID!, $catatan: String) {
  batalkanWorkOrder(id: $id, catatan: $catatan) {
    success
    message
  }
}
```

**Variables:**

```json
{
  "id": "6625aaa111bbb222ccc333dd",
  "catatan": "Pelanggan membatalkan pengajuan koneksi"
}
```

**Headers (tanpa x-signature):**

```
x-api-key: <INTERNAL_API_SECRET>
Authorization: Bearer <admin_access_token>
```

**Response sukses:**

```json
{
  "data": {
    "batalkanWorkOrder": {
      "success": true,
      "message": "Work order berhasil dibatalkan"
    }
  }
}
```

---

## 11. Error Handling

### 11.1 Error Codes

| Error              | Kondisi                                                    | HTTP-like Code |
| ------------------ | ---------------------------------------------------------- | -------------- |
| `VALIDATION_ERROR` | Input tidak valid, status tidak sesuai, prerequisite gagal | 400            |
| `NOT_FOUND`        | Work order / user / koneksi data tidak ditemukan           | 404            |
| `FORBIDDEN`        | Bukan penanggung jawab, role tidak sesuai                  | 403            |
| `UNAUTHENTICATED`  | Token tidak ada / invalid                                  | 401            |
| `BAD_USER_INPUT`   | Jenis pekerjaan tidak valid, ID format salah               | 400            |

### 11.2 Contoh Error Response

**Prerequisite belum terpenuhi:**

```json
{
  "errors": [
    {
      "message": "Prerequisite untuk pekerjaan 'rab' belum terpenuhi. Pastikan pekerjaan sebelumnya sudah selesai dan semua kondisi terpenuhi.",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

**Bukan penanggung jawab:**

```json
{
  "errors": [
    {
      "message": "Anda bukan teknisi penanggung jawab work order ini",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

**Status tidak sesuai:**

```json
{
  "errors": [
    {
      "message": "Hasil hanya bisa dikirim saat status 'sedang_dikerjakan' atau 'revisi'",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

**Signature tidak valid:**

```json
{
  "errors": [
    {
      "message": "Signature payload tidak valid",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

**Catatan penolakan terlalu pendek:**

```json
{
  "errors": [
    {
      "message": "Catatan penolakan wajib diisi minimal 10 karakter",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

**Gate respon belum diterima:**

```json
{
  "errors": [
    {
      "message": "Pekerjaan belum diterima oleh teknisi. Status respon saat ini: 'belum_direspon'",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

**Teknisi sedang mengerjakan pekerjaan lain (saat terima):**

```json
{
  "errors": [
    {
      "message": "Anda masih memiliki pekerjaan aktif yang belum selesai",
      "extensions": {
        "code": "VALIDATION_ERROR"
      }
    }
  ]
}
```

---

## 12. Catatan & Known Issues

### 12.1 Design Decisions

| Keputusan                                                 | Alasan                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1 WO = 1 jenis pekerjaan (record terpisah per tahap)      | Setiap tahap berdiri sendiri, tidak ada multi-stage dalam satu record           |
| `workOrderSebelumnya` sebagai chain reference             | Membentuk linked-list antar WO — traceable dan scalable                         |
| Unique partial index per jenis per koneksi                | Mencegah duplikasi WO aktif untuk jenis yang sama pada koneksi yang sama        |
| `jenisPekerjaan`, `idKoneksiData` immutable               | Mencegah perubahan konteks pekerjaan setelah WO dibuat                          |
| `workflowChain` query                                     | Memudahkan frontend menampilkan seluruh rantai workflow dalam satu panggilan    |
| Gate respon awal (`assertPekerjaanDiterima`)              | Memastikan teknisi secara sadar menerima pekerjaan sebelum mulai kerja          |
| `pekerjaanSekarang` di-set saat terima, bukan saat assign | Mencegah teknisi "terkunci" sebelum mereka tahu/setuju ada pekerjaan baru       |
| Penolakan harus direview admin                            | Admin tetap punya kontrol — bisa paksa teknisi terima jika tidak ada alternatif |
| `riwayatRespon` sebagai array                             | Menyimpan audit trail lengkap: terima, tolak, review, re-accept                 |
| `data` pada `simpanProgres` berupa JSON string            | Fleksibel untuk berbagai jenis dokumen tanpa perlu input type per jenis         |
| `riwayatReview` sebagai array                             | Menyimpan semua histori review (bisa ditolak berkali-kali)                      |
| Foreign key otomatis di-set server                        | Mencegah client mengirim ID yang salah/manipulatif                              |
| Dual status (`status` + `statusTim`)                      | Memisahkan lifecycle pekerjaan dan lifecycle approval tim                       |

### 12.2 Known Issues

| #   | Issue                                                                                 | Severity  |
| --- | ------------------------------------------------------------------------------------- | --------- |
| 1   | Model `Laporan` yang direferensikan oleh `PenyelesaianLaporan.idLaporan` belum dibuat | ⚠️ Medium |
| 2   | `DivisiEnum` dan `User` type duplikat di `auth.ts` dan `user.ts` typeDefs             | ⚠️ Low    |
| 3   | JWT access token default `"1m"` di config vs frontend cookie 15 menit — mismatch      | ⚠️ Medium |

### 12.3 Database Indexes

```javascript
// Compound indexes pada WorkOrder collection
{ idKoneksiData: 1, jenisPekerjaan: 1 }           // Query per koneksi + jenis
{ teknisiPenanggungJawab: 1, status: 1 }           // Query WO milik teknisi
{ teknisiPenanggungJawab: 1, statusRespon: 1 }     // Filter WO by respon status
{ status: 1, jenisPekerjaan: 1 }                   // Filter dashboard admin
{ workOrderSebelumnya: 1 }                         // Lookup chain reference

// Unique partial index: hanya boleh 1 WO aktif per jenis per koneksi data
{ idKoneksiData: 1, jenisPekerjaan: 1 }  unique, partialFilter: { status: { $ne: "dibatalkan" } }
```

### 12.4 Model MongoDB Collections

| Model Name                    | Collection Name               | Deskripsi                   |
| ----------------------------- | ----------------------------- | --------------------------- |
| `WorkOrder`                   | `PekerjaanTeknisi`            | Work order utama            |
| `User`                        | `TeknisiPerumdam`             | User teknisi                |
| `DataConnection`              | `KoneksiData`                 | Pengajuan koneksi pelanggan |
| `Survey`                      | `Survei`                      | Dokumen survei              |
| `RAB`                         | `RAB`                         | Rencana Anggaran Biaya      |
| `Pemasangan`                  | `Pemasangan`                  | Dokumen pemasangan          |
| `PengawasanPemasangan`        | `PengawasanPemasangan`        | Pengawasan saat pemasangan  |
| `PengawasanSetelahPemasangan` | `PengawasanSetelahPemasangan` | Pengawasan pasca pemasangan |
| `PenyelesaianLaporan`         | `PenyelesaianLaporan`         | Penyelesaian laporan        |

---

## Contoh Alur Lengkap End-to-End

Berikut alur **chain workflow** dari pembuatan work order survei hingga lanjut ke RAB. Setiap tahap = **Work Order terpisah**, terhubung via `workOrderSebelumnya`.

```
═══════════════════════════════════════════════════════════════
  WORK ORDER A: SURVEI (workOrderSebelumnya: null)
═══════════════════════════════════════════════════════════════

Step 1:  [Admin]    cekPrerequisitePekerjaan(koneksiData, "survei") → true ✅
Step 2:  [Admin]    buatWorkOrder(koneksiData, "survei", teknisiId)
                    → WO_A created
                    → status: menunggu_respon, statusRespon: belum_direspon
                    → workOrderSebelumnya: null (pekerjaan pertama)

Step 3:  [Teknisi]  terimaPekerjaan(WO_A)
                    → statusRespon: diterima, status: menunggu_tim
                    → User.pekerjaanSekarang: WO_A

Step 4:  [Teknisi]  kerjaSendiri(WO_A)
                    → status: ditugaskan, statusTim: disetujui

Step 5:  [Teknisi]  simpanProgres(WO_A, "{koordinat, foto, ...}")
                    → status: sedang_dikerjakan, idSurvei: <survey_doc_id>

Step 6:  [Teknisi]  kirimHasil(WO_A)
                    → status: dikirim

Step 7:  [Admin]    reviewHasil(WO_A, disetujui: true)
                    → status: selesai ✅ (FINAL)
                    → User.pekerjaanSekarang: null

═══════════════════════════════════════════════════════════════
  WORK ORDER B: RAB (workOrderSebelumnya: WO_A._id)
═══════════════════════════════════════════════════════════════

Step 8:  [Admin]    cekPrerequisitePekerjaan(koneksiData, "rab") → true ✅
                    (karena WO_A survei sudah selesai)

Step 9:  [Admin]    buatWorkOrder(koneksiData, "rab", teknisiId)
                    → WO_B created
                    → workOrderSebelumnya: WO_A._id (otomatis di-set oleh service)
                    → status: menunggu_respon

Step 10: [Teknisi]  terimaPekerjaan(WO_B)
                    → statusRespon: diterima, status: menunggu_tim

  ... (alur sama: tim → progres → kirim → review → selesai)

═══════════════════════════════════════════════════════════════
  WORK ORDER C: PEMASANGAN (workOrderSebelumnya: WO_B._id)
═══════════════════════════════════════════════════════════════

Step N:  [Admin]    cekPrerequisitePekerjaan(koneksiData, "pemasangan") → true ✅
                    (WO_B rab selesai + RAB.statusPembayaran === "settlement")

Step N+1: ...dan seterusnya membentuk chain
```

### Visualisasi Chain

```
KoneksiData "ABC"
│
├─→ WO_survei (id: A)  ──[selesai]──→  status: selesai ✅
│     ↑ workOrderSebelumnya: null
│
├─→ WO_rab (id: B)     ──[selesai]──→  status: selesai ✅
│     ↑ workOrderSebelumnya: A
│
├─→ WO_pemasangan (id: C) ──[aktif]──→ status: sedang_dikerjakan 🔄
│     ↑ workOrderSebelumnya: B
│
├─→ WO_pengawasan_pemasangan          → belum dibuat ⏳
├─→ WO_pengawasan_setelah_pemasangan  → belum dibuat ⏳
└─→ WO_penyelesaian_laporan           → belum dibuat ⏳ (standalone)
```

### Alur Alternatif: Teknisi Menolak Pekerjaan

```
Step 1:  [Admin]    buatWorkOrder(koneksiData, "survei", teknisiId)
                    → status: menunggu_respon, statusRespon: belum_direspon

Step 2:  [Teknisi]  ajukanPenolakan(workOrderId, alasan: "Lokasi terlalu jauh dari area saya")
                    → statusRespon: penolakan_diajukan

Step 3a: [Admin]    reviewPenolakan(workOrderId, disetujui: true)     # Admin setuju
                    → statusRespon: penolakan_diterima, status: dibatalkan ❌

  — ATAU —

Step 3b: [Admin]    reviewPenolakan(workOrderId, disetujui: false, catatan: "Tidak ada teknisi lain")
                    → statusRespon: penolakan_ditolak, status: menunggu_respon

Step 4b: [Teknisi]  terimaPekerjaan(workOrderId)                      # Wajib terima
                    → statusRespon: diterima, status: menunggu_tim
                    → Lanjut ke alur normal...
```
