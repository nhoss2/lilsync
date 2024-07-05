import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/cli.ts",
  output: {
    dir: "dist",
    format: "es",
    preserveModules: true,
    preserveModulesRoot: "src",
  },
  plugins: [
    typescript(),
    resolve({
      exportConditions: ["node"],
      preferBuiltins: true,
    }),
  ],
  external: [
    "commander",
    "@aws-sdk/client-s3",
    "@inquirer/prompts",
    "ansis",
    "bottleneck",
    "cosmiconfig",
    "dotenv",
    "exif-parser",
    "sharp",
    "winston",
    "zod",
  ],
};
