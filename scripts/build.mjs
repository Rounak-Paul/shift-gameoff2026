import { cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const file of ["index.html", "style.css", "src", "assets"])
  await cp(file, `dist/${file}`, { recursive: true });
await rm("shift-itch.zip", { force: true });
execFileSync("zip", ["-qr", "../shift-itch.zip", "."], { cwd: "dist" });
console.log("Built dist/ and shift-itch.zip (index.html at archive root).");
