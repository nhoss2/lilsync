import { cosmiconfigSync } from "cosmiconfig";
import * as dotenv from "dotenv";
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

const CredentialsSchema = z.object({
  accessKeyId: z.string(),
  secretKey: z.string(),
  endpointUrl: z.string(),
});

const ConfigSchema = z.object({
  bucketName: z.string(),
  inputConfig: InputConfigSchema,
  credentials: CredentialsSchema.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const validateConfig = (config: unknown): Config => {
  const configObj = ConfigSchema.parse(config);
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
};

export const getCredentials = (configCredentials?: {
  accessKeyId?: string;
  secretKey?: string;
  endpointUrl?: string;
}) => {
  const envCredentials = {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretKey: process.env.SECRET_KEY,
    endpointUrl: process.env.ENDPOINT_URL,
  };

  const finalCredentials = {
    accessKeyId: configCredentials?.accessKeyId || envCredentials.accessKeyId,
    secretKey: configCredentials?.secretKey || envCredentials.secretKey,
    endpointUrl: configCredentials?.endpointUrl || envCredentials.endpointUrl,
  };

  const parsedCredentials = CredentialsSchema.parse(finalCredentials);

  return parsedCredentials;
};

export const getConfig = (): Config => {
  try {
    const explorerSync = cosmiconfigSync("lilsync");
    const result = explorerSync.search();

    if (!result || !result.config) {
      throw new Error("configuration file not found or is empty");
    }

    const config = validateConfig(result.config);
    config.credentials = getCredentials(result.config.credentials);

    return config;
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
