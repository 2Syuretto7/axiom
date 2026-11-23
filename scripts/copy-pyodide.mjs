// Copies the Pyodide runtime from node_modules into public/pyodide so the app
// serves Python itself: no third-party CDN, and it can be cached for offline use.
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), "node_modules", "pyodide");
const to = path.join(process.cwd(), "public", "pyodide");
mkdirSync(to, { recursive: true });
for (const file of ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
  cpSync(path.join(from, file), path.join(to, file));
}
console.log("Pyodide runtime copied to public/pyodide");
