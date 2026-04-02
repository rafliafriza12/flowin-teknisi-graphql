# Dokumentasi Sistem Backend

Dokumen ini menjelaskan **sistem middleware**, **mekanisme refresh token**, dan **sistem role & permission** yang digunakan di project ini.

---

## 1. Sistem Middleware

Setiap request yang masuk ke server melewati beberapa layer middleware secara berurutan sebelum sampai ke resolver GraphQL.

### Urutan Eksekusi Middleware

```
Request masuk
    │
    ▼
┌─────────────────────────────┐
│  1. CORS Middleware         │  ← Validasi origin, method, headers
│     (express cors)          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  2. JSON Body Parser        │  ← Parse request body ke JSON
│     (express.json())        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  3. HTTP Context Middleware │  ← Generate unique request ID
│     (httpContextMiddleware) │     (x-request-id header)
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  4. Request Logger          │  ← Log method + URL (dev only)
│     (requestLoggerMiddleware│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  5. API Key Middleware      │  ← Validasi header x-api-key ★
│     (apiKeyMiddleware)      │     dengan INTERNAL_API_SECRET
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  6. Auth Middleware         │  ← Extract JWT dari header
│     (authMiddleware)        │     Authorization: Bearer <token>
│                             │     Lookup user di database
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  7. Permission Middleware   │  ← Cek apakah user punya
│     (withPermissions)       │     permission untuk operasi
│                             │     GraphQL yang diminta
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  8. GraphQL Resolver        │  ← Business logic dieksekusi
└─────────────────────────────┘
```

### Detail Setiap Middleware

#### 5. API Key Middleware (`apiKeyMiddleware.ts`)

**Tujuan:** Memastikan hanya client yang memiliki secret key yang bisa mengakses API.

**Cara kerja:**
1. Cek apakah `INTERNAL_API_SECRET` dikonfigurasi di environment
2. Jika tidak dikonfigurasi → skip (untuk kemudahan development)
3. Jika dikonfigurasi → baca header `x-api-key` dari request
4. Bandingkan dengan `crypto.timingSafeEqual()` (mencegah **timing attack**)
5. Key kosong → `401 Unauthenticated`
6. Key salah → `403 Forbidden`
7. Key cocok → lanjut ke middleware berikutnya

**Contoh request:**
```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -H "x-api-key: ba4d74309e236ec8c569de5f200c9b36..." \
  -d '{"query":"{ me { id } }"}'
```

#### 6. Auth Middleware (`authMiddleware.ts`)

**Tujuan:** Mengidentifikasi user yang sedang login dari JWT token.

**Cara kerja:**
1. Baca header `Authorization: Bearer <accessToken>`
2. Jika tidak ada → return `null` (request anonymous, bukan error)
3. Verify JWT access token menggunakan `JWT_ACCESS_SECRET`
4. Lookup user di database berdasarkan `userId` dari token payload
5. Cek apakah user masih `isActive`
6. Return user document → disimpan di `context.user`

> **Catatan:** Middleware ini TIDAK memblokir request tanpa token. Itu tugas Permission Middleware.

#### 7. Permission Middleware (`permissionMiddleware.ts`)

**Tujuan:** Meng-enforce akses berdasarkan role dan permission.

**Cara kerja:**
1. Setiap operasi GraphQL (Query/Mutation) di-mapping ke `PermissionType` di `permissions.ts`
2. Fungsi `withPermissions()` membungkus **semua resolver** secara otomatis
3. Sebelum resolver dieksekusi, middleware mengecek:

| Permission Type | Syarat |
|---|---|
| `"public"` | ✅ Siapa saja (tanpa login) |
| `"authenticated"` | ✅ Harus login (punya valid token) |
| `"userManagement"` | ✅ Role user harus punya flag `userManagement: true` |
| `"roleManagement"` | ✅ Role user harus punya flag `roleManagement: true` |
| `"superAdminOnly"` | ✅ Hanya role "Super Admin" (hardcoded check) |

4. Permission di-lookup dari **database** (collection `roles`) — bukan hardcoded
5. Hasil lookup di-**cache** selama 1 menit untuk performa
6. **Super Admin** otomatis bypass semua permission check

**Mapping permission saat ini:**

```
Query:
  me                    → authenticated
  users / user          → userManagement
  roles / role          → authenticated

Mutation:
  login / register      → public
  refreshToken          → public
  forgotPassword        → public
  resetPassword         → public
  logout                → authenticated
  changePassword        → authenticated
  createUser            → userManagement
  updateUser            → userManagement
  deleteUser            → userManagement
  createRole            → roleManagement
  updateRole            → roleManagement
  deleteRole            → roleManagement
  initializeDefaultRoles → superAdminOnly
```

---

## 2. Mekanisme Refresh Token

Project ini menggunakan **dual token strategy** (access + refresh token) untuk autentikasi.

### Alur Lengkap

```
┌───────────┐          ┌───────────┐          ┌───────────┐
│  Client   │          │  Server   │          │  MongoDB  │
└─────┬─────┘          └─────┬─────┘          └─────┬─────┘
      │                      │                      │
      │  1. POST login       │                      │
      │  {email, password}   │                      │
      │─────────────────────>│                      │
      │                      │  2. Verify password  │
      │                      │─────────────────────>│
      │                      │<─────────────────────│
      │                      │                      │
      │  3. Return tokens    │  4. Simpan tokens    │
      │  {accessToken,       │     ke user document │
      │   refreshToken}      │─────────────────────>│
      │<─────────────────────│                      │
      │                      │                      │
      │  5. Request + Bearer │                      │
      │     accessToken      │                      │
      │─────────────────────>│  6. Verify JWT       │
      │                      │     + lookup user    │
      │  7. Response data    │─────────────────────>│
      │<─────────────────────│                      │
      │                      │                      │
      │  ⏰ Token expired!   │                      │
      │                      │                      │
      │  8. POST refreshToken│                      │
      │  {refreshToken}      │                      │
      │─────────────────────>│  9. Verify refresh   │
      │                      │     token JWT +      │
      │                      │     compare with DB  │
      │                      │─────────────────────>│
      │                      │                      │
      │  10. New token pair  │  11. Update tokens   │
      │  {accessToken,       │      di database     │
      │   refreshToken}      │─────────────────────>│
      │<─────────────────────│                      │
      │                      │                      │
```

### Detail Teknis

#### Token Generation
```
Access Token:
  - Payload: { userId, email, role, type: "access" }
  - Secret: JWT_ACCESS_SECRET
  - Expiry: 15 menit (default)

Refresh Token:
  - Payload: { userId, email, role, type: "refresh" }
  - Secret: JWT_REFRESH_SECRET (secret berbeda!)
  - Expiry: 7 hari (default)
```

#### Proses Refresh (`authService.refreshTokens`)

1. Client kirim `refreshToken` via mutation `refreshToken(refreshToken: "...")`
2. Server verify JWT menggunakan `JWT_REFRESH_SECRET`
3. Cek `type === "refresh"` (mencegah access token dipakai sebagai refresh)
4. Lookup user di database berdasarkan `userId`
5. **Bandingkan refresh token dengan yang tersimpan di database** — jika tidak cocok, tolak (mencegah token reuse setelah logout)
6. Cek `user.isActive` — akun yang dinonaktifkan tidak bisa refresh
7. Generate **token pair baru** (access + refresh)
8. **Update kedua token** di database
9. Return token pair baru ke client

#### Keamanan Refresh Token

| Fitur | Implementasi |
|---|---|
| **Token revocation** | Token disimpan di DB; logout menghapus keduanya |
| **Single-use refresh** | Setiap refresh menghasilkan refresh token baru |
| **DB validation** | Token dibandingkan dengan yang tersimpan di DB |
| **Separate secrets** | Access & refresh token menggunakan secret berbeda |
| **Type checking** | JWT payload punya field `type` untuk mencegah token swap |
| **Active check** | User yang di-deactivate tidak bisa refresh |

#### Proses Logout
1. Hapus `accessToken` dan `refreshToken` dari user document di DB
2. Client menghapus token dari storage lokal
3. Request berikutnya dengan token lama akan gagal karena tidak cocok dengan DB

---

## 3. Sistem Role & Permission

### Model Role

Setiap role memiliki **9 permission flag** yang tersimpan di database (collection `roles`):

```typescript
interface IRolePermissions {
  readAllContent: boolean;       // Baca semua konten (admin panel)
  writeAllContent: boolean;      // Buat/edit konten
  deleteAllContent: boolean;     // Hapus konten
  categoryManagement: boolean;   // Kelola kategori
  roleManagement: boolean;       // Kelola role
  userManagement: boolean;       // Kelola user
  generalSettings: boolean;      // Edit setting umum
  notificationSettings: boolean; // Edit setting notifikasi
  integrationSettings: boolean;  // Edit setting integrasi
}
```

### Default Roles

| Role | System? | Semua Konten | Delete | Category | Role Mgmt | User Mgmt | Settings |
|---|---|---|---|---|---|---|---|
| **Super Admin** | ✅ Ya | ✅ R/W | ✅ | ✅ | ✅ | ✅ | ✅ All |
| **Admin** | ❌ | ✅ R/W | ✅ | ✅ | ❌ | ❌ | ✅ All |
| **Copywriter** | ❌ | ✅ R/W | ❌ | ❌ | ❌ | ❌ | ❌ |

### Hierarki Akses

```
Super Admin (bypass ALL permission checks)
    │
    ├── Semua yang Admin bisa
    ├── roleManagement (CRUD role)
    ├── userManagement (CRUD user)
    └── initializeDefaultRoles (system operation)

Admin
    │
    ├── Semua yang Copywriter bisa
    ├── deleteAllContent
    ├── categoryManagement
    └── generalSettings, notificationSettings, integrationSettings

Copywriter
    │
    ├── readAllContent (lihat semua konten di admin panel)
    └── writeAllContent (buat & edit konten)

Public (tanpa login)
    │
    ├── login, register, refreshToken
    ├── forgotPassword, resetPassword
    └── Baca konten yang dipublish (jika ada)
```

### Dynamic Role Management

Role bukan enum yang di-hardcode — melainkan **dokumen di database** yang bisa di-CRUD:

1. **Create Role** — buat role baru dengan permission flag custom
2. **Update Role** — ubah nama/permission; jika nama berubah, semua user dengan role tersebut otomatis di-update (**cascade update**)
3. **Delete Role** — hapus role; user yang memiliki role itu bisa:
   - Dipindahkan ke `fallbackRole` (jika diberikan)
   - Di-deactivate (`isActive: false`) jika tidak ada fallback
4. **System role** (`isSystem: true`) tidak bisa dihapus — proteksi untuk Super Admin

### Permission Cache

Untuk menghindari query database berulang pada setiap request:

```
Request masuk
    │
    ▼
Cache ada & umur < 1 menit?
    │
    ├── Ya → gunakan cache
    │
    └── Tidak → query database → simpan ke cache
```

- Cache otomatis di-clear saat role di-update atau dihapus
- TTL: **60 detik**
- Scope: per role name (in-memory `Map`)

---

## Ringkasan Flow Lengkap

```
Client mengirim request
    │
    ├── Header: x-api-key: <INTERNAL_API_SECRET>
    ├── Header: Authorization: Bearer <accessToken>  (optional)
    └── Body: { query: "mutation { login(...) }" }
    │
    ▼
[1] CORS → [2] JSON Parse → [3] Request ID → [4] Logger
    │
    ▼
[5] API Key Check ──── GAGAL ──→ 401/403 (ditolak)
    │
    ✅ PASS
    │
    ▼
[6] Auth Middleware ── extract user dari JWT (atau null)
    │
    ▼
[7] Permission Check
    │
    ├── "public"         → ✅ langsung lewat
    ├── "authenticated"  → cek context.user ada
    ├── "userManagement" → cek role.permissions.userManagement === true
    ├── "superAdminOnly" → cek role === "Super Admin"
    │
    ├── GAGAL → GraphQL Error (UNAUTHENTICATED / FORBIDDEN)
    │
    ✅ PASS
    │
    ▼
[8] Resolver → Service → Database → Response
```
