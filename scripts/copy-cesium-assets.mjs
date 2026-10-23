import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "cesium", "Build", "Cesium");
const target = join(root, "public", "cesium");

if (!existsSync(source)) {
  console.warn("Cesium assets are unavailable until dependencies are installed.");
  process.exit(0);
}

await mkdir(target, { recursive: true });
for (const entry of ["Assets", "ThirdParty", "Widgets", "Workers"]) {
  await cp(join(source, entry), join(target, entry), { recursive: true, force: true });
}

console.log("Cesium runtime assets copied to public/cesium.");
