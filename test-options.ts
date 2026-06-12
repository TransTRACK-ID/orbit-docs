import { marked } from "marked";
try {
  // @ts-ignore
  marked.parse("test", true);
  console.log("Success with boolean option");
} catch(e) {
  console.log("Crash with boolean option", e);
}
