<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string, ref as yupRef } from "yup";
import { useAuthStore } from "~/store/auth";
import { usePageStore } from "~/store/page";
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
const $page = usePageStore();
const router = useRouter();

$page.setTitle("Create your account");

const isShowPw = ref(false);
const isShowConfirmPw = ref(false);
const serverError = ref("");

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

const { handleSubmit, errors, setErrors } = useForm({ validationSchema: schema });

const { value: name } = useField<string>("name");
const { value: email } = useField<string>("email");
const { value: password } = useField<string>("password");
const { value: passwordConfirmation } = useField<string>("passwordConfirmation");

const strengthScore = computed(() => {
  const val = password.value || "";
  let score = 0;
  if (val.length >= 8) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  if (val.length >= 12 && /[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
  return Math.min(score, 4);
});

const strengthLabel = computed(() => {
  const labels = ["Weak", "Fair", "Good", "Strong"];
  const score = strengthScore.value;
  if (!password.value || password.value.length === 0) return "";
  return labels[Math.min(score, 3)];
});

const strengthClass = computed(() => {
  const classes = ["weak", "fair", "good", "strong"];
  const score = strengthScore.value;
  if (!password.value || password.value.length === 0) return "";
  return classes[Math.min(score, 3)];
});

const onSubmitRegister = handleSubmit(async (values) => {
  serverError.value = "";
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
  } catch (e: any) {
    serverError.value = e?.data?.message || "Registration failed. Please try again.";
    if (e?.statusCode === 409 || /email/i.test(serverError.value)) {
      setErrors({ email: serverError.value });
    }
  }
});
</script>

<template>
  <AppLayoutsAuth>
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
        <!-- Server error -->
        <div
          v-if="serverError"
          class="p-3 rounded-[var(--od-radius)] border text-[13px] font-medium"
          aria-live="polite"
          style="
            background: var(--od-error-bg);
            color: var(--od-error-text);
            border-color: var(--od-error);
          "
        >
          {{ serverError }}
        </div>

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
            autocomplete="name"
            class="w-full px-3 py-2.5 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-[border-color,box-shadow] focus:outline-none focus:border-[var(--od-accent)]"
            :class="{
               'border-[var(--od-error)]': errors.name,
            }"
            :style="
               errors.name
                 ? { boxShadow: '0 0 0 3px var(--od-error-soft)' }
                 : undefined
            "
            :aria-invalid="errors.name ? 'true' : undefined"
            :aria-describedby="errors.name ? 'nameError' : undefined"
          />
          <p
            v-if="errors.name"
            id="nameError"
            class="mt-1 text-[12px]"
            style="color: var(--od-error-text)"
            aria-live="polite"
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
              autocomplete="new-password"
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
          <!-- Strength meter -->
          <div class="mt-1.5 flex items-center gap-2">
            <div class="flex-1 flex gap-1">
              <div
                v-for="i in 4"
                :key="i"
                class="h-[3px] flex-1 rounded-full transition-colors"
                :class="{
                  'bg-[var(--od-border)]': i > strengthScore || !password,
                  'bg-[var(--od-error)]': strengthClass === 'weak' && i <= strengthScore,
                  'bg-[var(--od-warning)]': strengthClass === 'fair' && i <= strengthScore,
                  'bg-[var(--od-success)]': strengthClass === 'good' && i <= strengthScore,
                  'bg-[var(--od-info)]': strengthClass === 'strong' && i <= strengthScore,
                }"
              />
            </div>
            <span
              v-if="strengthLabel"
              class="text-[11px] font-medium tabular-nums"
              :class="{
                'text-[var(--od-error-text)]': strengthClass === 'weak',
                'text-[var(--od-warning-text)]': strengthClass === 'fair',
                'text-[var(--od-success-text)]': strengthClass === 'good',
                'text-[var(--od-info-text)]': strengthClass === 'strong',
              }"
            >
              {{ strengthLabel }}
            </span>
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
              autocomplete="new-password"
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-[border-color,box-shadow] focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[var(--od-error)]': errors.passwordConfirmation,
              }"
              :style="
                errors.passwordConfirmation
                  ? { boxShadow: '0 0 0 3px var(--od-error-soft)' }
                  : undefined
              "
              :aria-invalid="errors.passwordConfirmation ? 'true' : undefined"
              :aria-describedby="errors.passwordConfirmation ? 'passwordConfirmationError' : undefined"
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
            id="passwordConfirmationError"
            class="mt-1 text-[12px]"
            style="color: var(--od-error-text)"
            aria-live="polite"
          >
            {{ errors.passwordConfirmation }}
          </p>
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
  </AppLayoutsAuth>
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}
</style>
