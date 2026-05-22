<script setup lang="ts">
const router = useRouter();
function goToSetupPw() {
  router.push("/forgot-password");
}
</script>

<template>
  <div class="relative w-full h-screen overflow-hidden bg-gray-50">
    <img
      src="/bg-login-page.png"
      alt="background"
      class="absolute w-full h-full"
    />

    <div
      class="relative z-10 flex items-center justify-center w-full h-full p-4"
    >
      <div
        class="relative w-full max-w-[1164px] max-h-[750px] bg-white rounded-[20px] overflow-hidden shadow-lg"
      >
        <img
          src="/bg-expired.png"
          alt="expired image"
          class="w-full h-[650px] object-cover"
        />

        <div
          class="absolute top-0 left-0 w-full h-full flex flex-col items-center text-center px-10 py-16 gap-y-6"
        >
          <h2 class="text-[48px] font-bold text-black mb-4">
            Oops, this link <br />
            has expired
          </h2>
          <p class="text-base text-gray-700 w-[870px] mb-6 leading-[150%]">
            Hi there, your Set New Password link has expired, because you
            haven’t used it. Set New Password link expires after every 30
            minutes and can only be used once. You can request another link by
            clicking the button below.
          </p>
          <GeneralButton
            @on-click="goToSetupPw()"
            type="button"
            label="Setup New Password"
            variant="primary"
            class="w-[210px] h-12"
          />
        </div>
      </div>
    </div>
  </div>
</template>
