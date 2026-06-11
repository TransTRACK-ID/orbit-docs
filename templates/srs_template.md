# Dokumentasi Proyek — {{PROJECT_NAME}}

| Informasi Dokumen | Detail |
|---|---|
| **Nama Proyek** | {{PROJECT_NAME}} |
| **Versi Dokumen** | 1.0 (SRS) |
| **Tanggal** | {{CURRENT_DATE}} |
| **Status** | Draft — Tahap 1: Software Requirements Specification |
| **Git Snapshot** | {{CURRENT_DATE}} — [GIT-SNAPSHOT.md](./GIT-SNAPSHOT.md) |

### Referensi Git (Snapshot Codebase)

> **Agent Instruction:** For each repository, record the current HEAD commit (short + full SHA), commit date (UTC), branch/tag, and remote URL. Mirror the table format below.

| Codebase | Commit | Tanggal Commit (UTC) |
|---|---|---|
| `{{repo-dir-1}}/` | `{{short-sha}}` | {{commit-date}} |
| `{{repo-dir-2}}/` | `{{short-sha}}` | {{commit-date}} |

---

## Daftar Isi (Dokumentasi Lengkap)

| Bagian | Dokumen | Status |
|---|---|---|
| 1–2 | Software Requirements Specification (SRS) | ✅ Dokumen ini |
| 3 | Functional Specification Document (FSD) — User Flow | [FSD.md](./FSD.md) |
| 4 | System Design Document (SDD) | [SDD.md](./SDD.md) → per-repo SDD files |
| — | Referensi Git Snapshot | [GIT-SNAPSHOT.md](./GIT-SNAPSHOT.md) |

---

# Bagian 1 — Project Overview (SRS)

## 1.1 Ringkasan Eksekutif

> **Agent Instruction:** Analyze README, package manifests, and root structure across ALL repositories. Summarize the product purpose, target users, and main components in 2–4 paragraphs.

{{Executive Summary}}

### Komponen Utama

| Komponen | Teknologi | Peran |
|---|---|---|
| {{Component 1}} | {{Tech stack}} | {{Role}} |
| {{Component 2}} | {{Tech stack}} | {{Role}} |

---

## 1.2 Tujuan Sistem

### Tujuan Bisnis

> **Agent Instruction:** Derive 3–6 business goals from product functionality discovered in the codebases.

1. {{Business goal 1}}
2. {{Business goal 2}}

### Tujuan Teknis

> **Agent Instruction:** Derive technical goals from architecture, APIs, and deployment setup.

1. {{Technical goal 1}}
2. {{Technical goal 2}}

---

## 1.3 Ruang Lingkup Sistem (Scope)

### Dalam Lingkup (In Scope)

> **Agent Instruction:** Group discovered modules/features into logical scope areas (e.g., Auth, Master Data, Core Workflow).

#### A. {{Module Area 1}}
- {{Capability 1}}
- {{Capability 2}}

#### B. {{Module Area 2}}
- {{Capability 1}}

### Di Luar Lingkup (Out of Scope)

| Item | Keterangan |
|---|---|
| {{Out of scope item}} | {{Reason}} |

---

## 1.4 Target Pengguna (Stakeholders)

| Peran | Platform | Deskripsi |
|---|---|---|
| {{Role}} | {{Web/Mobile/API}} | {{Description}} |

---

## 1.5 Arsitektur Sistem (Ringkas)

> **Agent Instruction:** Provide an ASCII or mermaid diagram showing clients, API layer, data stores, and external services.

```
{{Architecture diagram}}
```

---

## 1.6 Asumsi dan Ketergantungan

| No | Asumsi / Ketergantungan |
|---|---|
| A1 | {{Assumption or dependency}} |

---

# Bagian 2 — Functional & Non-Functional Requirements (SRS)

## 2.1 Kebutuhan Fungsional (Functional Requirements)

> **Agent Instruction:** Scan routes, controllers, pages, and feature modules. Group requirements by module with ID (FR-01, FR-02…), sub-IDs, actor, priority, and detail tables.

### FR-01: {{Module Name}}

| ID | FR-01 |
|---|---|
| **Modul** | {{Module}} |
| **Deskripsi** | {{Description}} |
| **Aktor** | {{Actors}} |
| **Prioritas** | {{Tinggi/Sedang/Rendah}} |

| Sub-ID | Fitur | Deskripsi Detail |
|---|---|---|
| FR-01.1 | {{Feature}} | {{Detail}} |

*(Agent: Duplicate FR sections for each major module discovered)*

---

## 2.2 Kebutuhan Non-Fungsional (Non-Functional Requirements)

> **Agent Instruction:** Infer from middleware, auth, tests, CI, monitoring, and config files.

### NFR-01: Performa (Performance)

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-01.1 | {{Requirement}} | {{Target}} |

### NFR-02: Keamanan (Security)

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-02.1 | {{Requirement}} | {{Target}} |

### NFR-03: Ketersediaan & Reliabilitas

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-03.1 | {{Requirement}} | {{Target}} |

### NFR-04: Skalabilitas

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-04.1 | {{Requirement}} | {{Target}} |

### NFR-05: Usability

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-05.1 | {{Requirement}} | {{Target}} |

### NFR-06: Maintainability & Compatibility

| ID | Requirement | Target / Kriteria |
|---|---|---|
| NFR-06.1 | {{Requirement}} | {{Target}} |

---

## 2.3 Matriks Traceability (Fitur Utama → Requirement)

| Fitur Utama (Business) | Requirement ID |
|---|---|
| {{Feature}} | {{FR-XX}} |

---

## Riwayat Revisi

| Versi | Tanggal | Perubahan | Author |
|---|---|---|---|
| 1.0 | {{CURRENT_DATE}} | Draft awal — SRS | Orbit Docs Agent |

---

> **Dokumentasi lengkap:** [FSD.md](./FSD.md) · [SDD.md](./SDD.md) · [GIT-SNAPSHOT.md](./GIT-SNAPSHOT.md)
