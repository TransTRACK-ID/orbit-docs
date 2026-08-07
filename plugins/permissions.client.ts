export default defineNuxtPlugin(async () => {
  const { syncFromCurrentMember } = usePermissions();
  await syncFromCurrentMember();
});
