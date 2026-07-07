import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  bundle: true,
  entryPoints: [join(root, "src/preload.ts")],
  external: ["electron"],
  format: "cjs",
  outfile: join(root, "dist/electron/preload.cjs"),
  platform: "node",
  target: "node20"
});
