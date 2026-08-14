import type { InjectionKey, Ref } from "vue";

export interface WikiPageMeta {
  pageId: string;
  pageStatus: string;
}

export const wikiPageMetaKey: InjectionKey<Ref<WikiPageMeta>> = Symbol("wikiPageMeta");

export function provideWikiPageMeta() {
  const meta = ref<WikiPageMeta>({ pageId: "", pageStatus: "" });
  provide(wikiPageMetaKey, meta);
  return meta;
}

export function useWikiPageMeta() {
  return inject(
    wikiPageMetaKey,
    ref<WikiPageMeta>({ pageId: "", pageStatus: "" }),
  );
}
