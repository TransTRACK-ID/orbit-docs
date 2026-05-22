<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string } from "yup";
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

const router = useRouter();
const $page = usePageStore();

$page.setTitle("Reset password");

const isLoading = ref(false);
const isSubmitted = ref(false);

const schema = object({
  email: string()
    .email("Please enter a valid email address")
    .required("Email is required"),
});

const { handleSubmit, errors } = useForm({ validationSchema: schema });

const { value: email } = useField<string>("email");

const onSubmitForgot = handleSubmit(async (values) => {
  isLoading.value = true;
  try {
    // TODO: integrate with actual password reset API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    isSubmitted.value = true;
  } catch {
    // Error handling
  } finally {
    isLoading.value = false;
  }
});

function goToLogin() {
  router.push("/login");
}
</script>

<template>
  <AppLayoutsAuth>
    <!-- Card -->
    <div
      class="bg-[var(--od-surface)] border border-[var(--od-border)] rounded-[var(--od-radius-lg)] p-6"
    >
      <template v-if="!isSubmitted">
        <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-1">
          Reset password
        </h1>
        <p class="text-[14px] text-[var(--od-muted)] mb-6">
          Enter your email and we'll send you a link to reset your password.
        </p>

        <form @submit.prevent="onSubmitForgot" class="space-y-4">
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
                'border-[oklch(55%_0.18_25)]': errors.email,
              }"
              :style="
                errors.email
                  ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                  : undefined
              "
              :aria-invalid="errors.email ? 'true' : undefined"
              :aria-describedby="errors.email ? 'emailError' : undefined"
            />
            <p
              v-if="errors.email"
              id="emailError"
              class="mt-1 text-[12px]"
              style="color: oklch(50% 0.16 25)"
              aria-live="polite"
            >
              {{ errors.email }}
            </p>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-surface)] bg-[var(--od-accent)] border border-[var(--od-accent)] rounded-[var(--od-radius)] transition-colors hover:bg-[color-mix(in_oklch,var(--od-accent)_88%,black)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--od-accent)] focus-visible:outline-offset-2"
          >
            <IconsLoading
              v-if="isLoading"
              size="18"
              class="text-[var(--od-surface)] fill-[var(--od-surface)]"
            />
            <span v-else>Send reset link</span>
          </button>
        </form>

        <!-- Footer -->
        <div
          class="mt-6 pt-4 border-t border-[var(--od-border)] text-center text-[13px] text-[var(--od-muted)]"
        >
          Remember your password?
          <button
            type="button"
            class="font-medium text-[var(--od-accent)] hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-[var(--od-accent)] focus-visible:outline-offset-2 rounded-[var(--od-radius)]"
            @click="goToLogin"
          >
            Sign in
          </button>
        </div>
      </template>

      <template v-else>
        <h1 class="text-[18px] font-semibold text-[var(--od-fg)] mb-1">
          Check your email
        </h1>
        <p class="text-[14px] text-[var(--od-muted)] mb-6">
          We've sent a password reset link to <strong class="text-[var(--od-fg)]">{{ email }}</strong>.
          The link expires in 30 minutes.
        </p>

        <button
          type="button"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--od-surface)] bg-[var(--od-accent)] border border-[var(--od-accent)] rounded-[var(--od-radius)] transition-colors hover:bg-[color-mix(in_oklch,var(--od-accent)_88%,black)] focus-visible:outline-2 focus-visible:outline-[var(--od-accent)] focus-visible:outline-offset-2"
          @click="goToLogin"
        >
          Back to sign in
        </button>

        <div
          class="mt-6 pt-4 border-t border-[var(--od-border)] text-center text-[13px] text-[var(--od-muted)]"
        >
          Didn't receive it?
          <button
            type="button"
            class="font-medium text-[var(--od-accent)] hover:underline transition-colors focus-visible:outline-2 focus-visible:outline-[var(--od-accent)] focus-visible:outline-offset-2 rounded-[var(--od-radius)]"
            @click="isSubmitted = false"
          >
            Try again
          </button>
        </div>
      </template>
    </div>
  </AppLayoutsAuth>
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}
</style>
