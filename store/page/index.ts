export const usePageStore = defineStore('page', {
  state: () => ({
    title: '',
    selectedAppId: '',
    selectedVersionId: ''
  }),
  actions: {
    setTitle (title: string) {
      this.title = title
    },
    setSelectedAppId (id: string) {
      this.selectedAppId = id
      if (typeof window !== 'undefined') {
        localStorage.setItem('orbit:selectedAppId', id)
      }
    },
    setSelectedVersionId (id: string) {
      this.selectedVersionId = id
      if (typeof window !== 'undefined') {
        localStorage.setItem('orbit:selectedVersionId', id)
      }
    },
    hydrateSelection () {
      if (typeof window !== 'undefined') {
        const appId = localStorage.getItem('orbit:selectedAppId') || ''
        const versionId = localStorage.getItem('orbit:selectedVersionId') || ''
        this.selectedAppId = appId
        this.selectedVersionId = versionId
      }
    }
  }
})