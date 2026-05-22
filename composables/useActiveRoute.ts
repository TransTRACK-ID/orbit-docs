export function useActiveRoute() {
  const route = useRoute()

  const isActive = (path: string) => route.path === path

  return { isActive }
}
