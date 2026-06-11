# Git Snapshot — Referensi Codebase {{PROJECT_NAME}}

| Informasi | Detail |
|---|---|
| **Snapshot dibuat** | {{CURRENT_DATE}} |
| **Dibuat oleh** | Orbit Docs Agent |
| **Lokasi dokumentasi** | `docs/` |

Dokumen SRS, FSD, dan SDD ditulis berdasarkan **snapshot commit** di bawah. Gunakan referensi ini saat ingin memperbarui dokumentasi agar perubahan codebase sejak snapshot dapat dilacak dengan `git log` / `git diff`.

---

## Snapshot per Codebase

> **Agent Instruction:** For EACH cloned repository, run `git log -1` and `git remote -v` to fill this table with accurate data. Include branch/tag when available via `git describe --tags --abbrev=0` or branch name.

| Codebase | Direktori | Remote Repository | Branch | Tag | Commit (short) | Commit (full) | Tanggal Commit (UTC) | Pesan Commit |
|---|---|---|---|---|---|---|---|---|
| **{{Layer Name}}** | `{{repo-dir}}/` | `{{remote-url}}` | `{{branch}}` | {{tag or —}} | `{{short}}` | `{{full-sha}}` | {{datetime UTC}} | {{subject}} |

---

## Pemetaan Dokumen → Codebase Snapshot

| Dokumen | Codebase acuan | Commit acuan |
|---|---|---|
| [SRS.md](./SRS.md) | Semua codebase | Commit di atas |
| [FSD.md](./FSD.md) | Semua codebase | Commit di atas |
| [SDD.md](./SDD.md) | Semua codebase (indeks) | Commit di atas |
| [SDD-Backend.md](./SDD-Backend.md) | `{{backend-dir}}/` | `{{sha}}` |
| [SDD-Frontend.md](./SDD-Frontend.md) | `{{frontend-dir}}/` | `{{sha}}` |
| [SDD-Mobile.md](./SDD-Mobile.md) | `{{mobile-dir}}/` | `{{sha}}` |

---

## Cara Memperbarui Dokumentasi dari Snapshot

### 1. Ambil commit terbaru per codebase

```bash
cd {{repo-dir}} && git log -1 --format='%h %ci %s'
```

### 2. Lihat perubahan sejak snapshot

```bash
git log {{SNAPSHOT_COMMIT}}..HEAD --oneline
git diff {{SNAPSHOT_COMMIT}}..HEAD --stat
```

### 3. Perbarui dokumen terkait

| Jika berubah di… | Perbarui dokumen… |
|---|---|
| Backend (API, model, middleware) | SDD-Backend.md, mungkin SRS/FSD |
| Frontend (halaman, store, routing) | SDD-Frontend.md, mungkin FSD |
| Mobile (modul, BLoC, routing) | SDD-Mobile.md, FSD |
| Requirement/fitur baru lintas platform | SRS → FSD → SDD terkait |

### 4. Perbarui snapshot setelah revisi dokumen

1. Update tabel **Snapshot per Codebase** di dokumen ini.
2. Update bagian **Referensi Git** di header tiap dokumen yang direvisi.
3. Tambahkan baris di **Riwayat Revisi** dokumen yang diubah.

---

## Riwayat Snapshot

| Tanggal | Perubahan | Author |
|---|---|---|
| {{CURRENT_DATE}} | Snapshot awal | Orbit Docs Agent |
