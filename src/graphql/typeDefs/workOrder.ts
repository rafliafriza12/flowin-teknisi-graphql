const workOrderTypeDefs = `#graphql

  # ─── Enums ──────────────────────────────────────────────────────────────

  enum JenisPekerjaan {
    survei
    rab
    pemasangan
    pengawasan_pemasangan
    pengawasan_setelah_pemasangan
    penyelesaian_laporan
  }

  enum StatusPekerjaan {
    menunggu_respon
    menunggu_tim
    tim_diajukan
    ditugaskan
    sedang_dikerjakan
    dikirim
    revisi
    selesai
    dibatalkan
  }

  enum StatusTim {
    belum_diajukan
    diajukan
    disetujui
    ditolak
  }

  enum StatusRespon {
    belum_direspon
    diterima
    penolakan_diajukan
    penolakan_diterima
    penolakan_ditolak
  }

  enum StatusPengajuan {
    PENDING
    APPROVED
    REJECTED
  }

  # ─── Types ──────────────────────────────────────────────────────────────

  "Data pelanggan pemilik koneksi (diambil dari collection Pengguna)"
  type Pelanggan {
    id: ID!
    namaLengkap: String!
    email: String!
    noHp: String!
    alamat: String
  }

  "Data koneksi / permohonan sambungan pelanggan yang terkait dengan work order"
  type KoneksiData {
    id: ID!
    "Data pelanggan pemilik koneksi"
    pelanggan: Pelanggan
    "Status pengajuan koneksi data"
    statusPengajuan: StatusPengajuan!
    "NIK pelanggan (Nomor Induk Kependudukan)"
    nik: String!
    "Nomor Kartu Keluarga"
    noKK: String!
    "Nomor IMB (Izin Mendirikan Bangunan)"
    imb: String!
    "Alamat lengkap"
    alamat: String!
    "Kelurahan"
    kelurahan: String!
    "Kecamatan"
    kecamatan: String!
    "Luas bangunan (m2)"
    luasBangunan: Float!
    "Tanggal verifikasi"
    tanggalVerifikasi: String
    "Alasan penolakan (jika REJECTED)"
    alasanPenolakan: String
    "URL dokumen KTP"
    nikUrl: String!
    "URL dokumen KK"
    kkUrl: String!
    "URL dokumen IMB"
    imbUrl: String!
    createdAt: String!
    updatedAt: String!
  }

  type RiwayatReview {
    status: String!
    catatan: String
    oleh: User!
    tanggal: String!
  }

  type RiwayatRespon {
    aksi: String!
    alasan: String
    oleh: User!
    tanggal: String!
  }

  type WorkOrder {
    id: ID!
    idKoneksiData: ID!
    "Data koneksi pelanggan yang terkait (nested)"
    koneksiData: KoneksiData
    jenisPekerjaan: JenisPekerjaan!
    teknisiPenanggungJawab: User!
    tim: [User!]!
    statusTim: StatusTim!
    catatanTim: String
    status: StatusPekerjaan!
    # ─── Workflow Chain ─────────────────────────────────────
    "Referensi ke work order sebelumnya dalam rantai workflow (null jika pekerjaan pertama)"
    workOrderSebelumnya: WorkOrder
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

  "Ringkasan rantai workflow per koneksi data — menunjukkan tahap mana yang sudah/belum/sedang dikerjakan"
  type WorkflowChainItem {
    jenisPekerjaan: JenisPekerjaan!
    "Work order untuk tahap ini (null jika belum dibuat)"
    workOrder: WorkOrder
    "Status keterhubungan: 'selesai', 'aktif', 'belum_dibuat', 'dibatalkan'"
    chainStatus: String!
    "Urutan dalam rantai (1-based)"
    urutan: Int!
    "Apakah tahap ini bisa dibuat sekarang (prerequisite terpenuhi)"
    bisaDibuat: Boolean!
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

  # ─── Progres Data (untuk pre-fill form revisi) ──────────────────────────────

  type KoordinatProgres {
    longitude: Float!
    latitude: Float!
  }

  "Data progres pekerjaan yang sudah tersimpan, digunakan untuk pre-fill form saat revisi"
  type ProgresData {
    jenisPekerjaan: JenisPekerjaan!
    koordinat: KoordinatProgres
    urlJaringan: String
    diameterPipa: Float
    urlPosisiBak: String
    posisiMeteran: String
    jumlahPenghuni: Int
    standar: Boolean
    totalBiaya: Float
    urlRab: String
    seriMeteran: String
    fotoRumah: String
    fotoMeteran: String
    fotoMeteranDanRumah: String
    urlGambar: [String!]
    catatan: String
  }

  # ─── Inputs ─────────────────────────────────────────────────────────────

  input BuatWorkOrderInput {
    idKoneksiData: ID!
    jenisPekerjaan: JenisPekerjaan!
    teknisiPenanggungJawab: ID!
  }

  input AjukanTimInput {
    workOrderId: ID!
    anggotaTim: [ID!]!
  }

  input ReviewTimInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  input SimpanProgresInput {
    workOrderId: ID!
    data: String!
  }

  input KirimHasilInput {
    workOrderId: ID!
  }

  input ReviewHasilInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  input WorkOrderFilterInput {
    status: StatusPekerjaan
    jenisPekerjaan: JenisPekerjaan
    statusTim: StatusTim
    statusRespon: StatusRespon
    teknisiPenanggungJawab: ID
    idKoneksiData: ID
  }

  input KerjaSendiriInput {
    workOrderId: ID!
  }

  input TerimaPekerjaanInput {
    workOrderId: ID!
  }

  input AjukanPenolakanInput {
    workOrderId: ID!
    alasan: String!
  }

  input ReviewPenolakanInput {
    workOrderId: ID!
    disetujui: Boolean!
    catatan: String
  }

  # ─── Queries ────────────────────────────────────────────────────────────

  extend type Query {
    workOrders(
      filter: WorkOrderFilterInput
      pagination: PaginationInput
    ): WorkOrderListResponse!

    workOrder(id: ID!): WorkOrder

    workOrdersSaya(
      filter: WorkOrderFilterInput
      pagination: PaginationInput
    ): WorkOrderListResponse!

    workOrdersByKoneksiData(idKoneksiData: ID!): [WorkOrder!]!

    "Mendapatkan rantai workflow lengkap untuk satu koneksi data — menunjukkan semua tahap dan statusnya"
    workflowChain(idKoneksiData: ID!): [WorkflowChainItem!]!

    cekPrerequisitePekerjaan(
      idKoneksiData: ID!
      jenisPekerjaan: JenisPekerjaan!
    ): Boolean!

    "Ambil data progres yang tersimpan untuk work order (untuk pre-fill form revisi)"
    progresWorkOrder(workOrderId: ID!): ProgresData
  }

  # ─── Mutations ──────────────────────────────────────────────────────────

  extend type Mutation {
    # Admin: Buat work order dan tugaskan teknisi
    buatWorkOrder(input: BuatWorkOrderInput!): WorkOrderMutationResponse!

    # ─── Respon Awal Teknisi ──────────────────────────────────────────

    # Teknisi: Terima pekerjaan (gate utama sebelum workflow lanjutan)
    terimaPekerjaan(input: TerimaPekerjaanInput!): WorkOrderMutationResponse!

    # Teknisi: Ajukan penolakan pekerjaan
    ajukanPenolakan(input: AjukanPenolakanInput!): WorkOrderMutationResponse!

    # Admin: Review penolakan teknisi (terima/tolak penolakan)
    reviewPenolakan(input: ReviewPenolakanInput!): WorkOrderMutationResponse!

    # ─── Workflow Setelah Penerimaan ──────────────────────────────────

    # Teknisi: Ajukan anggota tim
    ajukanTim(input: AjukanTimInput!): WorkOrderMutationResponse!

    # Teknisi: Kerja sendiri tanpa tim tambahan
    kerjaSendiri(input: KerjaSendiriInput!): WorkOrderMutationResponse!

    # Admin: Review pengajuan tim (setujui/tolak)
    reviewTim(input: ReviewTimInput!): WorkOrderMutationResponse!

    # Teknisi: Simpan progres pekerjaan (draft)
    simpanProgres(input: SimpanProgresInput!): WorkOrderMutationResponse!

    # Teknisi: Kirim hasil untuk di-review admin
    kirimHasil(input: KirimHasilInput!): WorkOrderMutationResponse!

    # Admin: Review hasil pekerjaan (setujui/tolak)
    reviewHasil(input: ReviewHasilInput!): WorkOrderMutationResponse!

    # Admin: Batalkan work order
    batalkanWorkOrder(id: ID!, catatan: String): BatalkanWorkOrderResponse!
  }
`;

export default workOrderTypeDefs;
