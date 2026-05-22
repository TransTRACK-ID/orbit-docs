<script setup lang="ts">
import { useField, useForm } from "vee-validate";
import { object, string, ref as yupRef } from "yup";

const isShowPw = ref(false);
const isShowPwConfirm = ref(false);

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

const onSubmit = handleSubmit((values) => {
  // TODO: INTEGRATION FORGOT PASSWORD
  console.log(values);
});
</script>

<template>
  <AppLayoutsAuth>
    <div class="w-full max-w-[500px] flex flex-col gap-y-5 mt-5">
      <div class="absolute top-[130px] z-10">
        <h2 class="text-[44px] font-bold">Create New Password</h2>
      </div>
      <form @submit.prevent="onSubmit" class="mt-12 space-y-6">
        <span class="text-sm text-gray-700">
          Fill with new password for your reason security
        </span>

        <GeneralTextInput
          id="inputNewPass"
          v-model="password"
          :type="isShowPw ? 'text' : 'password'"
          label="New Password"
          placeholder="New Password"
          required
        >
          <template #suffix>
            <div class="cursor-pointer" @click.stop="isShowPw = !isShowPw">
              <IconsEye v-if="isShowPw" size="20" class="stroke-gray-700" />
              <IconsEyeOff v-else size="20" class="stroke-gray-700" />
            </div>
          </template>
        </GeneralTextInput>
        <p class="text-red-500 text-sm" v-if="errors.password">
          {{ errors.password }}
        </p>

        <GeneralTextInput
          id="inputNewPassConfirm"
          v-model="passwordConfirm"
          :type="isShowPwConfirm ? 'text' : 'password'"
          label="New Password Confirm"
          placeholder="New Password Confirm"
          required
        >
          <template #suffix>
            <div
              class="cursor-pointer"
              @click.stop="isShowPwConfirm = !isShowPwConfirm"
            >
              <IconsEye
                v-if="isShowPwConfirm"
                size="20"
                class="stroke-gray-700"
              />
              <IconsEyeOff v-else size="20" class="stroke-gray-700" />
            </div>
          </template>
        </GeneralTextInput>
        <p class="text-red-500 text-sm" v-if="errors.passwordConfirm">
          {{ errors.passwordConfirm }}
        </p>

        <GeneralButton
          type="submit"
          label="Create New Password"
          variant="primary"
          class="w-[210px] h-12"
        />
      </form>
    </div>
  </AppLayoutsAuth>
</template>
