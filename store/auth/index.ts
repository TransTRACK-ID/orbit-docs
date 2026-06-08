import { useAuth } from "#imports";
import { defineStore } from "pinia";
import { toast } from "vue3-toastify";
import { ValidationError } from "yup";
import { setupCookies } from "~/utils/cookies";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    isLoading: false,
    email: "",
    password: "",
  }),
  actions: {
    async login() {
      this.isLoading = true;
      // TODO: NEXT CHECT COMPANY
      // let selectedCompany = useSelectedCompany();
      const { signIn, data } = useAuth();

      try {
        const result = await signIn(
          {
            email: this.email,
            password: this.password,
          },
          { callbackUrl: `/` }
        );

        // Check if companies data exists and set the company ID
        // TODO: CHECK THIS COMPANY
        // if (
        //   data?.value?.data?.companies &&
        //   data.value.data.companies.length > 0
        // ) {
        //   const companyId = data.value.data.companies[0].id;
        //   if (companyId) {
        //     selectedCompany.setCompanyId(companyId);
        //   }
        // }

        useIsUnauthorized().value = false;
        setupCookies();

        return true;
      } catch (error: unknown) {
        console.error("[Auth Store] Login error:", error);

        // Type assertion for error handling
        const err = error as any;
        if (err.data?.code === 429) {
          toast.error(err.data.message, {
            toastClassName: "toastify-error",
          });
        } else {
          toast.error("Login failed. Please try again.", {
            toastClassName: "toastify-error",
          });
        }
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async register(payload: {
      name: string;
      email: string;
      password: string;
      passwordConfirmation: string;
    }) {
      this.isLoading = true;
      try {
        const response = await $fetch("/api/auth/register", {
          method: "POST",
          body: payload,
        });
        return response;
      } catch (error: unknown) {
        const err = error as any;
        toast.error(err.data?.message || "Registration failed. Please try again.", {
          toastClassName: "toastify-error",
        });
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async logout() {
      try {
        const { signOut } = useAuth();
        this.clearCookies();

        await signOut({ callbackUrl: "/login" });

        return true;
      } catch (e) {
        toast.error((e as ValidationError).message);
        throw e;
      } finally {
        this.isLoading = false;
      }
    },
    clearCookies() {
      const authCookie = useCookie("auth.token");
      const sessionToken = useCookie("session_token");
      const initialized = useCookie("auth.initialized");

      if (authCookie.value !== undefined) {
        authCookie.value = null;
      }

      if (sessionToken.value !== undefined) {
        sessionToken.value = null;
      }

      if (initialized.value !== undefined) {
        initialized.value = null;
      }
    },
  },
});
