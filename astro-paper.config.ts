import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://tiger627.github.io",
    title: "Tiger An",
    description: "Writing about Microsoft Fabric, Power BI, and data engineering.",
    author: "Tiger An",
    profile: "https://www.linkedin.com/in/tiger627",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Europe/Amsterdam",
    dir: "ltr",
  },
  posts: {
    perPage: 10,
    perIndex: 10,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github",   url: "https://github.com/tiger627" },
    { name: "linkedin", url: "https://www.linkedin.com/in/tiger627" },
    { name: "mail",     url: "mailto:tiger.an.8686@gmail.com" },
  ],
  shareLinks: [
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "linkedin", url: "https://www.linkedin.com/sharing/share-offsite/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
