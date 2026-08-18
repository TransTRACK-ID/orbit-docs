import { isPublicRoute } from "~/utils/public-routes";

export default defineNuxtPlugin(async () => {
  const route = useRoute();
  if (isPublicRoute(route.path)) return;

  const { status, getSession } = useAuth();
  await getSession();

  if (status.value !== "authenticated") return;

  const { syncFromCurrentMember } = usePermissions();
  await syncFromCurrentMember();
});
