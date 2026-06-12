import { renderMarkdown } from "./composables/useMarkdown.js";
const md = `
# Title
Some text with **bold** and \`code\` and [link](https://example.com).

> [!NOTE]
> This is a note with **bold**.

- [ ] Task 1
- [x] Task 2

\`\`\`javascript
function foo() {}
\`\`\`

## h2
`;
console.log(renderMarkdown(md));
