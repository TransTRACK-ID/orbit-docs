import { toast } from "vue3-toastify";
import type { SsoConfig, SsoProvider, SsoProviderType } from "~/types/sso";
import { SSO_PROVIDER_METADATA } from "~/types/sso";

export const useSsoSettings = () => {
  const ssoConfig = ref<SsoConfig | null>(null);
  const isLoadingSso = ref(false);
  const isSavingSso = ref(false);

  async function fetchSsoConfig() {
    isLoadingSso.value = true;
    try {
      const data = await $fetch<{ success: boolean; config: SsoConfig }>("/api/settings/sso");
      ssoConfig.value = data.config;
    } catch (e: any) {
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error("Failed to load SSO configuration");
      }
      console.error(e);
    } finally {
      isLoadingSso.value = false;
    }
  }

  async function saveSsoProvider(provider: SsoProvider) {
    isSavingSso.value = true;
    try {
      const data = await $fetch<{ success: boolean; provider: SsoProvider }>("/api/settings/sso", {
        method: "POST",
        body: { provider },
      });
      // Update local state
      if (ssoConfig.value) {
        const idx = ssoConfig.value.providers.findIndex(p => p.id === data.provider.id);
        if (idx >= 0) {
          ssoConfig.value.providers[idx] = data.provider;
        } else {
          ssoConfig.value.providers.push(data.provider);
        }
      }
      toast.success("Provider saved");
      return data.provider;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to save provider";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    } finally {
      isSavingSso.value = false;
    }
  }

  async function deleteSsoProvider(providerId: string) {
    try {
      await $fetch("/api/settings/sso", {
        method: "DELETE",
        body: { providerId },
      });
      if (ssoConfig.value) {
        ssoConfig.value.providers = ssoConfig.value.providers.filter(p => p.id !== providerId);
        if (ssoConfig.value.defaultProvider === providerId) {
          ssoConfig.value.defaultProvider = undefined;
        }
      }
      toast.success("Provider removed");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to remove provider";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function toggleSsoProvider(providerId: string, enabled: boolean) {
    try {
      const data = await $fetch<{ success: boolean; provider: SsoProvider }>("/api/settings/sso/toggle", {
        method: "PATCH",
        body: { providerId, enabled },
      });
      if (ssoConfig.value) {
        const idx = ssoConfig.value.providers.findIndex(p => p.id === providerId);
        if (idx >= 0) {
          ssoConfig.value.providers[idx] = data.provider;
        }
      }
      toast.success(enabled ? "Provider enabled" : "Provider disabled");
      return data.provider;
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to toggle provider";
      if (e?.statusCode === 401) {
        toast.error("Session expired. Please sign in again.");
        navigateTo("/login");
      } else {
        toast.error(msg);
      }
      throw e;
    }
  }

  async function setDefaultProvider(providerId: string | undefined) {
    if (!ssoConfig.value) return;
    try {
      // Save the entire config as a provider update
      const updated = { ...ssoConfig.value, defaultProvider: providerId };
      // We need to save the config object; but our POST endpoint expects a provider.
      // For now, update the default provider by updating the config directly via a PUT.
      // We'll create a PUT handler later.
      ssoConfig.value.defaultProvider = providerId;
      toast.success("Default provider updated");
    } catch (e: any) {
      const msg = e?.data?.message || e?.message || "Failed to update default provider";
      toast.error(msg);
      throw e;
    }
  }

  function buildEmptyProvider(type: SsoProviderType): SsoProvider {
    const now = new Date().toISOString();
    const base = {
      id: crypto.randomUUID(),
      type,
      name: SSO_PROVIDER_METADATA[type].name,
      enabled: false,
      clientId: "",
      clientSecret: "",
      callbackUrl: "",
      createdAt: now,
      updatedAt: now,
    };

    switch (type) {
      case "keycloak":
        return { ...base, realm: "", baseUrl: "", authUrl: "", tokenUrl: "", userInfoUrl: "", logoutUrl: "" };
      case "azure":
        return { ...base, tenantId: "" };
      case "oidc":
        return { ...base, issuerUrl: "", authUrl: "", tokenUrl: "", userInfoUrl: "", logoutUrl: "" };
      case "google":
      case "github":
      default:
        return base as SsoProvider;
    }
  }

  return {
    ssoConfig,
    isLoadingSso,
    isSavingSso,
    fetchSsoConfig,
    saveSsoProvider,
    deleteSsoProvider,
    toggleSsoProvider,
    setDefaultProvider,
    buildEmptyProvider,
  };
};
