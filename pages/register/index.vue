<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string, ref as yupRef } from "yup";
import { useAuthStore } from "~/store/auth";
import { toast } from "vue3-toastify";

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

const $auth = useAuthStore();
const router = useRouter();

const isShowPw = ref(false);
const isShowConfirmPw = ref(false);

const schema = object({
  name: string().required("Full name is required"),
  email: string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  passwordConfirmation: string()
    .oneOf([yupRef("password")], "Passwords do not match")
    .required("Please confirm your password"),
});

const { handleSubmit, errors } = useForm({ validationSchema: schema });

const { value: name } = useField<string>("name");
const { value: email } = useField<string>("email");
const { value: password } = useField<string>("password");
const { value: passwordConfirmation } = useField<string>("passwordConfirmation");

const onSubmitRegister = handleSubmit(async (values) => {
  try {
    await $auth.register({
      name: values.name,
      email: values.email,
      password: values.password,
      passwordConfirmation: values.passwordConfirmation,
    });

    toast.success("Account created. Signing you in...", {
      toastClassName: "toastify-success",
    });

    // Auto-login after registration
    $auth.email = values.email;
    $auth.password = values.password;
    await $auth.login();
  } catch {
    // Errors are handled in the store
  }
});
</script>

<template>
  <AppLayoutsAuth>
    <!-- Brand -->
    <div class="flex items-center justify-center gap-2.5 mb-8">
      <svg
        class="w-[22px] h-[22px] text-[var(--od-accent)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        />
        <path d="M2 12h20" />
      </svg>
      <span class="text-lg font-semibold text-[var(--od-fg)]">Orbit Docs</span>
    </div>

    <!-- Card -->
    <div
      class="bg-[var(--od-surface)] border border-[var(--od-border)] rounded-[var(--od-radius-lg)] p-6"
    >
      <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-1">
        Create your account
      </h1>
      <p class="text-[14px] text-[var(--od-muted)] mb-6">
        Join your team's documentation workspace.
      </p>

      <form @submit.prevent="onSubmitRegister" class="space-y-4">
        <!-- Full name -->
        <div>
          <label
            for="inputName"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            Full name
          </label>
          <input
            id="inputName"
            v-model="name"
            type="text"
            placeholder="e.g. Sarah Chen"
            required
            class="w-full px-3 py-2.5 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
            :class="{
              'border-[oklch(55%_0.18_25)]': errors.name,
            }"
            :style="
              errors.name
                ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                : undefined
            "
          />
          <p
            v-if="errors.name"
            class="mt-1 text-[12px]"
            style="color: oklch(50% 0.16 25)"
          >
            {{ errors.name }}
          </p>
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
            class="w-full px-3 py-2.5 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
            :class="{
              'border-[oklch(55%_0.18_25)]': errors.email,
            }"
            :style="
              errors.email
                ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                : undefined
            "
          />
          <p
            v-if="errors.email"
            class="mt-1 text-[12px]"
            style="color: oklch(50% 0.16 25)"
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
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[oklch(55%_0.18_25)]': errors.password,
              }"
              :style="
                errors.password
                  ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                  : undefined
              "
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
            class="mt-1 text-[12px]"
            style="color: oklch(50% 0.16 25)"
          >
            {{ errors.password }}
          </p>
        </div>

        <!-- Confirm password -->
        <div>
          <label
            for="inputConfirmPass"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            Confirm password
          </label>
          <div class="relative">
            <input
              id="inputConfirmPass"
              v-model="passwordConfirmation"
              :type="isShowConfirmPw ? 'text' : 'password'"
              placeholder="••••••••"
              required
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[oklch(55%_0.18_25)]': errors.passwordConfirmation,
              }"
              :style="
                errors.passwordConfirmation
                  ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                  : undefined
              "
            />
            <button
              type="button"
              tabindex="-1"
              class="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-[var(--od-muted)] hover:text-[var(--od-fg)] transition-colors"
              @click="isShowConfirmPw = !isShowConfirmPw"
            >
              <IconsEye
                v-if="isShowConfirmPw"
                size="18"
                class="text-[var(--od-muted)]"
              />
              <IconsEyeOff v-else size="18" class="text-[var(--od-muted)]" />
            </button>
          </div>
          <p
            v-if="errors.passwordConfirmation"
            class="mt-1 text-[12px]"
            style="color: oklch(50% 0.16 25)"
          >
            {{ errors.passwordConfirmation }}
          </p>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="$auth.isLoading"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-surface)] bg-[var(--od-accent)] border border-[var(--od-accent)] rounded-[var(--od-radius)] transition-colors hover:bg-[color-mix(in_oklch,var(--od-accent)_88%,black)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <IconsLoading
            v-if="$auth.isLoading"
            size="18"
            class="text-[var(--od-surface)] fill-[var(--od-surface)]"
          />
          <span v-else>Create account</span>
        </button>
      </form>

      <!-- Footer -->
      <div
        class="mt-6 pt-4 border-t border-[var(--od-border)] text-center text-[13px] text-[var(--od-muted)]"
      >
        Already have an account?
        <NuxtLink
          to="/login"
          class="font-medium text-[var(--od-accent)] hover:underline transition-colors"
        >
          Sign in
        </NuxtLink>
      </div>
    </div>

    <!-- Page foot -->
    <footer class="mt-6 text-center text-[12px] text-[var(--od-muted)]">
      <span>Orbit Docs · Internal documentation platform</span>
    </footer>
  </AppLayoutsAuth>
</template>
