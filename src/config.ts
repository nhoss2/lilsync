import * as dotenv from "dotenv";
import { cosmiconfigSync } from "cosmiconfig";
import { z } from "zod";

import { supportedFileTypes } from "./types";

dotenv.config();

const ExtSchema = z.enum(supportedFileTypes);

const OutputImageConfigSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  ext: ExtSchema.optional(),
  quality: z.number().min(1).max(100).optional(),
});

const InputConfigSchema = z.object({
  outputPath: z.string(),
  inputPath: z.string(),
  outputImages: z.array(OutputImageConfigSchema).min(1),
});

const ConfigSchema = z.object({
  bucketName: z.string(),
  inputConfig: InputConfigSchema,
});

export type Config = z.infer<typeof ConfigSchema>;

export const getConfig = (): Config => {
  try {
    const explorerSync = cosmiconfigSync("lilsync");
    const result = explorerSync.search();

    if (!result || !result.config) {
      throw new Error("configuration file not found or is empty");
    }

    const configObj = ConfigSchema.parse(result.config);
    const { inputConfig } = configObj;

    const outputImages = inputConfig.outputImages;

    const dimensionSet = new Set<string>();

    outputImages.forEach((image, index) => {
      const dimensionKey = image.width
        ? `width:${image.width}`
        : `height:${image.height}`;
      if (dimensionSet.has(dimensionKey)) {
        throw new Error(
          `Duplicate dimension found in OutputImageConfig at index ${index}: ${dimensionKey}`
        );
      }

      dimensionSet.add(dimensionKey);
    });

    return configObj;
  } catch (err) {
    if (err instanceof z.ZodError) {
      const formattedErrors = err.errors
        .map((error) => {
          const path = error.path.join(".");
          const message = error.message;
          return `Error in config field "${path}": ${message}`;
        })
        .join("\n");
      throw new Error(`Configuration validation error:\n${formattedErrors}`);
    } else if (err instanceof Error) {
      throw new Error(`Unexpected error: ${err.message}`);
    } else {
      throw new Error(`Unknown error: ${err}`);
    }
  }
};
