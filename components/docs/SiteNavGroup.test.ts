import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SiteNavGroup from "./SiteNavGroup.vue";
import type { NavGroup } from "~/server/database/schema";

const group: NavGroup = {
  id: "video-generation",
  label: "Video Generation",
  pages: ["4-core"],
  groups: [
    {
      id: "video-generation-carousel",
      label: "Carousel",
      groups: [
        { id: "video-generation-carousel-rendering", label: "Rendering", pages: ["2-render"] },
        { id: "video-generation-carousel-upload", label: "Upload", pages: ["3-upload"] },
      ],
    },
  ],
};

function mountGroup(visible: string[]) {
  return mount(SiteNavGroup, {
    props: {
      group,
      depth: 1,
      pageTitles: new Map([
        ["4-core", "Core Guide"],
        ["2-render", "Rendering"],
        ["3-upload", "Upload"],
      ]),
      pageStatuses: new Map<string, string>(),
      publishedSlugSet: new Set(visible),
      basePath: "/wiki/smoke",
      activePageSlug: "2-render",
      showStatus: false,
    },
    global: {
      stubs: {
        NuxtLink: {
          props: ["to"],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  });
}

describe("SiteNavGroup", () => {
  it("renders pages three levels deep plus the node's own pages", () => {
    const wrapper = mountGroup(["4-core", "2-render", "3-upload"]);
    const hrefs = wrapper.findAll("a").map((a) => a.attributes("href"));
    expect(hrefs).toEqual(["/wiki/smoke/4-core", "/wiki/smoke/2-render", "/wiki/smoke/3-upload"]);
    expect(wrapper.find('a[href="/wiki/smoke/2-render"]').classes()).toContain("active");
    expect(wrapper.html()).toContain('href="/wiki/smoke/2-render"');
  });

  it("renders nothing when no descendant page is visible", () => {
    const wrapper = mountGroup(["unrelated"]);
    expect(wrapper.find("li").exists()).toBe(false);
  });

  it("hides branches with no visible pages but keeps visible siblings", () => {
    const wrapper = mountGroup(["3-upload"]);
    const hrefs = wrapper.findAll("a").map((a) => a.attributes("href"));
    expect(hrefs).toEqual(["/wiki/smoke/3-upload"]);
  });
});
