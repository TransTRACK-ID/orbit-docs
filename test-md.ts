import { renderMarkdown } from "./composables/useMarkdown.js"; // or just use absolute path? Wait, nuxt has auto-imports. tsx might need .ts extension or just useMarkdown

const md = `
# Title
**Bold** and \`code\`
> [!NOTE]
> Alert
- [ ] Task
`;
console.log(renderMarkdown(md));
