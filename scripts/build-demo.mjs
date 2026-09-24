import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { URL } from "node:url";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "build"],
  {
    cwd: new URL("../frontend/", import.meta.url),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_BASE_PATH:
        process.env.NEXT_PUBLIC_BASE_PATH ?? "/food-finder",
    },
  },
);
process.exit(result.status ?? 1);
