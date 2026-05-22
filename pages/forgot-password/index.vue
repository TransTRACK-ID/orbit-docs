<script setup lang="ts">
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

const email = ref("");

function goToLogin() {
  router.push("/login");
}
</script>

<template>
  <AppLayoutsAuth>
    <div class="w-full max-w-[500px] flex flex-col gap-y-5 mt-5">
      <GeneralLink id="info-link" label="Back to Login" @on-click="goToLogin()">
        <template #prefix>
          <IconsArrowLeft class="w-4 h-4 !stroke-primary-700" />
        </template>
      </GeneralLink>

      <h2 class="text-[44px] font-bold">Setup New Password</h2>

      <span>
        Enter your email to Setup New Password. We will send you a link to
        create a New Password.
      </span>

      <GeneralTextInput
        v-model="email"
        id="inputEmail"
        type="text"
        label="Email"
        placeholder="Enter Email Address"
        required
      />

      <GeneralButton
        type="button"
        label="Send Link"
        variant="primary"
        class="w-[181px] h-12"
      />
    </div>
  </AppLayoutsAuth>
</template>
