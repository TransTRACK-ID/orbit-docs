<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string } from "yup";
import { useAuthStore } from "~/store/auth";

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

const isShowPw = ref();
const isShowNotificationError = ref(false);

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

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === "Enter") {
    onSubmitLogin();
  }
}

onMounted(async () => {
  await getSession();
});
</script>

<template>
  <AppLayoutsAuth class="items-center">
    <div class="w-full max-w-[500px]">
      <div class="absolute top-[130px] z-10">
        <h2 class="text-[44px] font-bold">Welcome back</h2>
        <h3 class="text-[44px] font-bold">
          to <span class="text-primary-700">Bunker Monitor System</span>
        </h3>
      </div>

      <form
        class="mt-24 space-y-6"
        @submit.prevent="onSubmitLogin"
        @keydown.enter.prevent="handleKeyPress"
      >
        <p class="text-sm text-gray-700">
          Please sign in to your account below.
        </p>
        <GeneralTextInput
          v-model="email"
          id="inputEmail"
          type="text"
          label="Email"
          placeholder="Email Addess"
          class="mb-5"
          required
        />
        <p v-if="errors.email" class="text-sm text-red-500">
          {{ errors.email }}
        </p>
        <GeneralTextInput
          v-model="password"
          id="inputPass"
          :type="isShowPw ? 'text' : 'password'"
          label="Password"
          placeholder="Password"
          class="mb-2"
          required
        >
          <template #suffix>
            <div
              class="pointer-events-auto cursor-pointer"
              @click.stop="isShowPw = !isShowPw"
            >
              <IconsEye v-if="isShowPw" size="20" class="stroke-gray-700" />
              <IconsEyeOff v-else size="20" class="stroke-gray-700" />
            </div>
          </template>
        </GeneralTextInput>
        <p v-if="errors.password" class="text-sm text-red-500">
          {{ errors.password }}
        </p>

        <p class="w-full text-sm text-black hover:underline">
          <nuxt-link to="/forgot-password">Forgot password?</nuxt-link>
        </p>
        <GeneralButton
          type="submit"
          label="Login"
          :disabled="$auth.isLoading"
          :loading="$auth.isLoading"
          variant="primary"
          class="w-[181px] h-12"
        />
      </form>
    </div>
  </AppLayoutsAuth>
</template>
