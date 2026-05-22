<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string, ref as yupRef } from "yup";
import { usePageStore } from "~/store/page";

const $page = usePageStore();

$page.setTitle("Create new password");

const isShowPw = ref(false);
const isShowPwConfirm = ref(false);
const isLoading = ref(false);

const schema = object({
  password: string()
    .required("New password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[0-9]/, "Password must contain at least one number")
    .matches(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character"
    ),
  passwordConfirm: string()
    .required("Confirm password is required")
    .oneOf([yupRef("password")], "Passwords must match"),
});

const { handleSubmit, errors } = useForm({
  validationSchema: schema,
});

const { value: password } = useField<string>("password");
const { value: passwordConfirm } = useField<string>("passwordConfirm");

const onSubmit = handleSubmit(async (values) => {
  isLoading.value = true;
  try {
    // TODO: INTEGRATION FORGOT PASSWORD
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(values);
  } finally {
    isLoading.value = false;
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
        Create new password
      </h1>
      <p class="text-[14px] text-[var(--od-muted)] mb-6">
        Your new password must be at least 8 characters and include lowercase, uppercase, number, and special characters.
      </p>

      <form @submit.prevent="onSubmit" class="space-y-4">
        <!-- New Password -->
        <div>
          <label
            for="inputNewPass"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            New password
          </label>
          <div class="relative">
            <input
              id="inputNewPass"
              v-model="password"
              :type="isShowPw ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="new-password"
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[oklch(55%_0.18_25)]': errors.password,
              }"
              :style="
                errors.password
                  ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
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
            style="color: oklch(50% 0.16 25)"
          >
            {{ errors.password }}
          </p>
        </div>

        <!-- Confirm Password -->
        <div>
          <label
            for="inputNewPassConfirm"
            class="block text-[13px] font-medium text-[var(--od-fg)] mb-1.5"
          >
            Confirm password
          </label>
          <div class="relative">
            <input
              id="inputNewPassConfirm"
              v-model="passwordConfirm"
              :type="isShowPwConfirm ? 'text' : 'password'"
              placeholder="••••••••"
              required
              autocomplete="new-password"
              class="w-full px-3 py-2.5 pr-10 text-[14px] text-[var(--od-fg)] bg-[var(--od-bg)] border border-[var(--od-border)] rounded-[var(--od-radius)] placeholder:text-[var(--od-muted)] transition-colors focus:outline-none focus:border-[var(--od-accent)]"
              :class="{
                'border-[oklch(55%_0.18_25)]': errors.passwordConfirm,
              }"
              :style="
                errors.passwordConfirm
                  ? { boxShadow: '0 0 0 3px color-mix(in oklch, oklch(55% 0.18 25) 20%, transparent)' }
                  : undefined
              "
              :aria-invalid="errors.passwordConfirm ? 'true' : undefined"
              :aria-describedby="errors.passwordConfirm ? 'passwordConfirmError' : undefined"
            />
            <button
              type="button"
              tabindex="-1"
              class="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-[var(--od-muted)] hover:text-[var(--od-fg)] transition-colors"
              @click="isShowPwConfirm = !isShowPwConfirm"
            >
              <IconsEye
                v-if="isShowPwConfirm"
                size="18"
                class="text-[var(--od-muted)]"
              />
              <IconsEyeOff v-else size="18" class="text-[var(--od-muted)]" />
            </button>
          </div>
          <p
            v-if="errors.passwordConfirm"
            id="passwordConfirmError"
            class="mt-1 text-[12px]"
            style="color: oklch(50% 0.16 25)"
          >
            {{ errors.passwordConfirm }}
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
          <span v-else>Reset password</span>
        </button>
      </form>
    </div>

    <!-- Page foot -->
    <footer class="mt-6 text-center text-[12px] text-[var(--od-muted)]">
      <span>Orbit Docs · Internal documentation platform</span>
    </footer>
  </AppLayoutsAuth>
</template>

<style scoped>
input:focus {
  box-shadow: 0 0 0 3px var(--od-accent-soft);
}
</style>
