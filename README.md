# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Project Guide

Panduan ini menjelaskan struktur dan cara kerja bagian-bagian penting pada proyek, mencakup Auth, Service API, komponen UI, store, halaman, sidebar, dan tema.

### Stack & Modul

- Framework: `Nuxt 3` (SPA, `ssr: false`)
- State: `Pinia` dengan `@pinia-plugin-persistedstate/nuxt`
- Auth: `@sidebase/nuxt-auth` (provider `local`)
- UI: `TailwindCSS`, komponen lokal di `components/`
- PWA: `@vite-pwa/nuxt`
- Utilities: `ofetch`, `h3`, dan beberapa composables

File penting:

- `nuxt.config.ts` untuk konfigurasi modul dan auth
- `server/api/auth/*` untuk endpoint server-side auth
- `services/api.ts` untuk helper HTTP API
- `store/*` untuk state terstruktur
- `components/general/*` untuk komponen UI reusable

### Environment

Pastikan variabel berikut tersedia di `.env`:

- `API_BASE_URL` → dipakai sebagai `runtimeConfig.public.baseAPI`
- `APP_KEY` → kunci enkripsi 32-byte untuk payload login di server

Contoh `.env`:

```env
API_BASE_URL=https://api.example.com
APP_KEY=32-CHAR-ENCRYPTION-KEY-HERE-XXXXXXXXXXXXXX
```

### Auth Flow (Nuxt Auth + Server + Store)

- Provider `local` (lihat `nuxt.config.ts`) dengan endpoints:
  - `signIn` → `/api/auth/login`
  - `getSession` → `/api/auth/session`
  - `signOut` → `/api/auth/logout`
- Server endpoints (`server/api/auth`):
  - `login.post.ts`: mengenkripsi `{ email, password }` dengan `APP_KEY`, forward ke `baseAPI/api/v1/auth/login`, menyimpan cookie `session_token`.
  - `session.get.ts`: validasi `session_token` ke `baseAPI/api/v1/auth/session` (header `Authorization: Bearer <token>`).
  - `logout.post.ts`: forward logout ke `baseAPI/api/logout`.
- Store Auth (`store/auth/index.ts`):
  - `login()` memanggil `useAuth().signIn` dan men-setup cookies via `utils/cookies.ts`.
  - `logout()` memanggil `useAuth().signOut`, clear cookies, redirect ke `/login`.
- Unauthorized handling:
  - `composables/is-unauthorized.ts` dipakai untuk flag global saat 401; `services/api.ts` otomatis set flag dan sign-out.

Catatan konsistensi endpoint:

- Selaraskan konfigurasi `nuxt-auth` agar path cocok dengan file server:

```ts
// cuplikan yang direkomendasikan untuk nuxt.config.ts
auth: {
  provider: {
    type: 'local',
    endpoints: {
      signIn:   { path: '/login',   method: 'post' },
      signOut:  { path: '/logout',  method: 'post' },
      getSession: { path: '/session', method: 'get' },
    },
    pages: { login: '/login' },
    token: { signInResponseTokenPointer: '/data/access_token', maxAgeInSeconds: 60 * 60 * 24 },
  },
  globalAppMiddleware: true,
}
```

### Service API (`services/api.ts`)

Helper HTTP terpusat dengan fitur:

- `api.provider(...)`: menyusun URL dan headers (menambahkan `Authorization` dari `useAuth()` bila tersedia).
- `api.afterResponse(...)`: menangani error standar, 500 → `/server-error`, 401 → set unauthorized + sign-out, 4xx → melempar data error.
- Metode: `get`, `post`, `put`, `delete`.

Contoh GET:

```ts
import { api } from "~/services/api";

export async function fetchUsers() {
  return await api.get("/api/v1/users", { queryParams: { page: "1" } });
}
```

Contoh POST:

```ts
import { api } from "~/services/api";

export async function createUser(payload: { name: string; email: string }) {
  return await api.post("/api/v1/users", { body: payload });
}
```

Contoh unduh file (byte stream):

```ts
import { api } from "~/services/api";

export async function downloadReport() {
  const blob = await api.get("/api/v1/reports/monthly", { isByte: true });
  return blob as Blob;
}
```

Catatan header:

- Gunakan `application/octet-stream` untuk konten byte (bukan `octret`).

### Komponen UI: OutlinedButton

- File: `components/general/OutlinedButton/index.vue`
- Props:
  - `id`, `type: 'button'|'submit'|'reset'`, `label`, `disabled`, `loading`,
  - `color: 'primary'|'success'|'info'|'warning'|'error'|'default'`
- Emit: `on-click`
- Slots: `prefix`, `suffix`
- Storybook referensi: https://storybook.transtrack.id/?path=/story/general-outlinedbutton--outlined-button-story
- Instalasi: `npm install @transtrack/nuxt-ui` dan cara import component ada pada halaman storybook

Contoh penggunaan:

```vue
<script setup lang="ts">
import { GeneralOutlinedButton } from "#components";

function handleClick() {
  console.log("Clicked");
}
</script>

<template>
  <GeneralOutlinedButton
    id="btn-demo"
    label="Lihat Detail"
    color="primary"
    @on-click="handleClick"
  >
    <template #prefix>
      <span class="inline-block w-2 h-2 bg-primary-500 rounded-full"></span>
    </template>
  </GeneralOutlinedButton>
</template>
```

### Store Halaman (`store/page/index.ts`) & Dashboard

- Store menyimpan judul halaman dan setter `setTitle(title: string)`.
- Contoh di `pages/dashboard/index.vue`:

```vue
<script setup lang="ts">
import { usePageStore } from "~/store/page";
const $page = usePageStore();
onBeforeMount(() => {
  $page.setTitle("Dashboard");
});
</script>

<template>
  <div class="text-gray-500">dashboard pages</div>
</template>
```

### Sidebar (`constant/sidebar.ts`)

- Struktur menu menggunakan tipe `ISidebar`, mendukung item tunggal dan nested `menu`.
- Ikon diambil dari `#components` dan dibungkus `markRaw` agar tidak direaktifkan.
- Contoh rendering:

```vue
<script setup lang="ts">
import { sidebarMenu } from "~/constant/sidebar";
</script>

<template>
  <nav class="w-64 bg-white border-r">
    <ul class="space-y-1">
      <li v-for="item in sidebarMenu" :key="item.id">
        <NuxtLink
          :to="item.route || item.startWith"
          class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
        >
          <component :is="item.icon" class="w-4 h-4" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <ul v-if="item.menu" class="pl-6">
          <li v-for="sub in item.menu" :key="sub.id">
            <NuxtLink
              :to="sub.route"
              class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50"
            >
              <component :is="sub.icon" class="w-4 h-4" />
              <span>{{ sub.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>
```

### Tema (`composables/theme.ts`)

- `useTheme()` mengelola `color` dan `mode`.
- `setColor(mainColor)` menyalin semua `--{mainColor}-{shade}` menjadi `--primary-{shade}` untuk konsistensi styling.
- Gunakan saat client lifecycle (proyek ini SPA, aman akses `document`).

Contoh:

```vue
<script setup lang="ts">
import { useTheme } from "~/composables/theme";
const { color, setColor } = useTheme();

function changeTheme(name: string) {
  setColor(name);
}
</script>

<template>
  <div class="flex gap-2">
    <button class="px-3 py-2 border" @click="changeTheme('primary')">
      Primary
    </button>
    <button class="px-3 py-2 border" @click="changeTheme('purple')">
      Purple
    </button>
    <button class="px-3 py-2 border" @click="changeTheme('success')">
      Success
    </button>
  </div>

  <div class="mt-2 text-primary-500">Tema aktif: {{ color }}</div>
</template>
```

### Tips Pengembangan

- Pastikan Auth provider path selaras dengan server (`/login`, `/session`, `/logout`).
- Untuk error 401 dari API, aplikasi otomatis sign-out dan redirect ke `/login`.
- Jika backend mensyaratkan `Bearer` prefix, pastikan header `Authorization` mengikuti format yang benar.
- Gunakan `services/api.ts` untuk semua request agar konsisten dan terpusat.
