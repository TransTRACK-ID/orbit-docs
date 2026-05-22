<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string } from "yup";
import { useAuthStore } from "~/store/auth";
import { usePageStore } from "~/store/page";

definePageMeta({
  auth: {
    unauthenticatedOnly: true,
    navigateAuthenticatedTo: "/",
  },
  layout: "login",
  layoutTransition: {
    mode: "out-in",
  },
});

const { getSession } = useAuth();
const $auth = useAuthStore();
const $page = usePageStore();

$page.setTitle("Sign in");

const isShowPw = ref(false);
const isShowNotificationError = ref(false);
const rememberMe = ref(false);

const schema = object({
  email: string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: string().required("Password is required"),
});

const { handleSubmit, errors } = useForm({ validationSchema: schema });

const { value: email } = useField<string>("email");
const { value: password } = useField<string>("password");

const onSubmitLogin = handleSubmit(async (values) => {
  isShowNotificationError.value = false;
  $auth.email = values.email;
  $auth.password = values.password;

  await $auth.login().catch((e) => {
    if (e?.statusCode === 400 || e?.statusCode === 401) {
      isShowNotificationError.value = true;
    }
  });
});

onMounted(async () => {
  await getSession();
});
</script>

<template>
  <AppLayoutsAuth>
    <!-- Card -->
    <div
      class="bg-[var(--od-surface)] border border-[var(--od-border)] rounded-[var(--od-radius-lg)] p-6"
    >
      <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-1">
        Sign in
      </h1>
      <p class="text-[14px] text-[var(--od-muted)] mb-6">
        Enter your credentials to access your workspace.
      </p>

      <form @submit.prevent="onSubmitLogin" class="space-y-4">
        <!-- Global error -->
        <div
          v-if="isShowNotificationError"
          class="p-3 rounded-[var(--od-radius)] border text-[13px] font-medium"
          aria-live="polite"
          style="
            background: var(--od-error-bg);
            color: var(--od-error-text);
            border-color: var(--od-error);
          "
        >
          Invalid email or password. Please try again.
        </div>

        <!-- Email -->
        <div>
          <label
            for="inputEmail"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            Email
          </label>
          <input
            id="inputEmail"
            v-model="email"
            type="email"
            placeholder="you@company.com"
            required
            autocomplete="email"
            class="w-full px-3 py-2.5 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-[border-color,box-shadow] focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[var(--od-error)]': errors.email,
              }"
              :style="
                errors.email
                  ? { boxShadow: '0 0 0 3px var(--od-error-soft)' }
                  : undefined
              "
            :aria-invalid="errors.email ? 'true' : undefined"
            :aria-describedby="errors.email ? 'emailError' : undefined"
          />
          <p
            v-if="errors.email"
            id="emailError"
            class="mt-1 text-[12px]"
            style="color: var(--od-error-text)"
            aria-live="polite"
          >
            {{ errors.email }}
          </p>
        </div>

        <!-- Password -->
        <div>
          <label
            for="inputPass"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            Password
          </label>
          <div class="relative">
            <input
              id="inputPass"
              v-model="password"
              :type="isShowPw ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-[border-color,box-shadow] focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[var(--od-error)]': errors.password,
              }"
              :style="
                errors.password
                  ? { boxShadow: '0 0 0 3px var(--od-error-soft)' }
                  : undefined
              "
              :aria-invalid="errors.password ? 'true' : undefined"
              :aria-describedby="errors.password ? 'passwordError' : undefined"
            />
            <button
              type="button"
              tabindex="-1"
              class="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-[var(--od-muted)] hover:text-[var(--od-fg)] transition-colors"
              @click="isShowPw = !isShowPw"
            >
              <IconsEye
                v-if="isShowPw"
                size="18"
                class="text-[var(--od-muted)]"
              />
              <IconsEyeOff v-else size="18" class="text-[var(--od-muted)]" />
            </button>
          </div>
          <p
            v-if="errors.password"
            id="passwordError"
            class="mt-1 text-[12px]"
            style="color: var(--od-error-text)"
            aria-live="polite"
          >
            {{ errors.password }}
          </p>
        </div>

        <!-- Remember me + Forgot password -->
        <div class="flex items-center justify-between">
          <label class="inline-flex items-center gap-2 text-[13px] text-[var(--od-muted)] cursor-pointer select-none">
            <input
              v-model="rememberMe"
              type="checkbox"
              class="w-4 h-4 accent-[var(--od-accent)] cursor-pointer"
            />
            Remember me
          </label>
          <NuxtLink
            to="/forgot-password"
            class="text-[13px] text-[var(--od-muted)] hover:text-[var(--od-fg)] hover:underline transition-colors"
          >
            Forgot password?
          </NuxtLink>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="$auth.isLoading"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-surface)] bg-[var(--od-accent)] border border-[var(--od-accent)] rounded-[var(--od-radius)] transition-colors hover:bg-[color-mix(in_oklch,var(--od-accent)_88%,black)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--od-accent)] focus-visible:outline-offset-2"
        >
          <IconsLoading
            v-if="$auth.isLoading"
            size="18"
            class="text-[var(--od-surface)] fill-[var(--od-surface)]"
          />
          <span v-else>Sign in</span>
        </button>
      </form>

      <!-- Footer -->
      <div
        class="mt-6 pt-4 border-t border-[var(--od-border)] text-center text-[13px] text-[var(--od-muted)]"
      >
        Don't have an account?
        <NuxtLink
          to="/register"
          class="font-medium text-[var(--od-accent)] hover:underline transition-colors"
        >
          Register
        </NuxtLink>
      </div>
    </div>
  </AppLayoutsAuth>
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}
</style>
