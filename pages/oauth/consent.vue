<script setup lang="ts">
import { useAuthStore } from "~/store/auth";
import { oauthConsentUrl, rememberConsentRequest } from "~/utils/oauth-consent";

// Auth is checked here instead of by the global middleware so the request id
// survives the login round trip.
definePageMeta({
  auth: false,
  layout: "login",
});

interface ConsentRequest {
  request_id: string;
  client_id: string;
  client_name: string | null;
  redirect_host: string;
  scopes: string[];
  scope_descriptions: string[];
  expires_at: string;
  user: { id: string; email: string; name: string | null };
  role: string | null;
}

const route = useRoute();
const { status } = useAuth();
const authStore = useAuthStore();

const consent = ref<ConsentRequest | null>(null);
const errorMessage = ref("");
const isLoading = ref(true);
const submitting = ref<"" | "approve" | "deny">("");

const requestId = computed(() =>
  typeof route.query.request_id === "string" ? route.query.request_id : "",
);

const userLabel = computed(() => {
  const user = consent.value?.user;
  if (!user) return "";
  return [user.name, user.email].filter(Boolean).join(" · ");
});

function consentUrl(action = "") {
  return `/api/oauth/requests/${encodeURIComponent(requestId.value)}${action}`;
}

async function goToLogin() {
  rememberConsentRequest(requestId.value);
  const appBase = useRuntimeConfig().app.baseURL?.replace(/\/$/, "") || "";
  const redirect = encodeURIComponent(oauthConsentUrl(requestId.value));
  await navigateTo(`${appBase}/login?redirect=${redirect}`);
}

async function handleError(e: any) {
  const httpStatus = e?.response?.status ?? e?.statusCode;
  if (httpStatus === 401) {
    await goToLogin();
    return;
  }
  errorMessage.value =
    e?.data?.message ||
    "This authorization request is invalid or has expired. Start the connection again from your AI app.";
}

async function loadRequest() {
  if (!requestId.value) {
    errorMessage.value =
      "Missing authorization request. Start the connection again from your AI app.";
    isLoading.value = false;
    return;
  }
  if (status.value !== "authenticated") {
    await goToLogin();
    return;
  }
  try {
    const res = await $fetch<{ data?: ConsentRequest } | ConsentRequest>(consentUrl());
    consent.value = (res as any).data ?? (res as ConsentRequest);
  } catch (e) {
    await handleError(e);
  } finally {
    isLoading.value = false;
  }
}

async function decide(action: "approve" | "deny") {
  if (submitting.value) return;
  submitting.value = action;
  try {
    const res = await $fetch<{ redirect_url: string; data?: { redirect_url: string } }>(
      consentUrl(`/${action}`),
      { method: "POST" },
    );
    const redirectUrl = res.redirect_url ?? res.data?.redirect_url;
    if (!redirectUrl) throw new Error("Missing redirect URL");
    window.location.href = redirectUrl;
  } catch (e) {
    submitting.value = "";
    await handleError(e);
  }
}

async function switchAccount() {
  rememberConsentRequest(requestId.value);
  await authStore.logout().catch(() => {});
  await goToLogin();
}

onMounted(loadRequest);
</script>

<template>
  <AppLayoutsAuth>
    <div class="bg-[var(--od-surface)] border border-[var(--od-border)] rounded-[var(--od-radius-lg)] p-6">
      <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-1">
        Authorize MCP access
      </h1>
      <p class="text-[14px] text-[var(--od-muted)] mb-6">
        An AI application wants to read your Orbit Docs workspace through the MCP server.
      </p>

      <p v-if="isLoading" class="text-sm text-[var(--od-muted)] text-center py-6">
        Loading authorization request…
      </p>

      <div
        v-else-if="errorMessage"
        role="alert"
        class="p-3 rounded-[var(--od-radius)] border text-[13px] font-medium"
        style="background: var(--od-error-bg); color: var(--od-error-text); border-color: var(--od-error)"
      >
        {{ errorMessage }}
      </div>

      <template v-else-if="consent">
        <div class="border border-[var(--od-border)] rounded-[var(--od-radius)] p-4 mb-4 space-y-3 text-sm">
          <div>
            <p class="font-semibold text-[var(--od-fg)] mb-1">Application</p>
            <p class="text-[var(--od-muted)]">
              {{ consent.client_name || consent.client_id }}
              <span class="block text-[12px]">will return you to {{ consent.redirect_host }}</span>
            </p>
          </div>
          <div>
            <p class="font-semibold text-[var(--od-fg)] mb-1">It will be able to</p>
            <ul class="list-disc pl-5 text-[var(--od-muted)] space-y-1">
              <li v-for="desc in consent.scope_descriptions" :key="desc">{{ desc }}</li>
            </ul>
          </div>
          <div v-if="userLabel">
            <p class="font-semibold text-[var(--od-fg)] mb-1">Signed in as</p>
            <p class="text-[var(--od-muted)]">
              {{ userLabel }}
              <span v-if="consent.role" class="block text-[12px]">Workspace role: {{ consent.role }}</span>
            </p>
          </div>
        </div>

        <p class="text-xs text-[var(--od-muted)] mb-6">
          Access is read-only and limited to what your account can already see.
          Only approve apps you trust.
        </p>

        <div class="flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-[var(--od-radius)] px-4 py-2.5 text-[14px] font-semibold border border-[var(--od-border)] text-[var(--od-muted)] disabled:opacity-60"
            :disabled="!!submitting"
            @click="decide('deny')"
          >
            {{ submitting === "deny" ? "Denying…" : "Deny" }}
          </button>
          <button
            type="button"
            class="flex-1 rounded-[var(--od-radius)] px-4 py-2.5 text-[14px] font-semibold bg-blue-600 text-white disabled:opacity-60"
            :disabled="!!submitting"
            @click="decide('approve')"
          >
            {{ submitting === "approve" ? "Approving…" : "Allow" }}
          </button>
        </div>

        <button
          type="button"
          class="mt-4 w-full text-center text-[12px] text-[var(--od-muted)] underline disabled:opacity-60"
          :disabled="!!submitting"
          @click="switchAccount"
        >
          Not you? Switch account
        </button>
      </template>
    </div>
  </AppLayoutsAuth>
</template>
