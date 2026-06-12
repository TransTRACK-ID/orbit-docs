import { extractHeadings } from "./composables/useMarkdown.js";
// I will just copy the fallback parser code here to test it

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMd(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

const md = `
# Title
Some text with **bold** and \`code\` and [link](https://example.com).
`;
const lines = md.split("\n");
const out: string[] = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("# ")) {
    out.push(`<h1>${inlineMd(escapeHtml(line.slice(2)))}</h1>`);
  } else if (line.trim() !== "") {
    out.push(`<p>${inlineMd(escapeHtml(line))}</p>`);
  }
}
console.log(out.join("\n"));
