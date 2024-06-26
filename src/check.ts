import { promises as fs } from "fs";
import * as path from "path";
import type { S3Client } from "@aws-sdk/client-s3";
import ansis from "ansis";

import { getConfig } from "./config";
import { logger } from "./logger";
import { getClient } from "./s3";
import { buildState } from "./state";

export const checkState = async (
  outputPath: string | undefined
): Promise<void> => {
  try {
    const config = getConfig();
    const { bucketName, inputConfig } = config;

    const s3Client: S3Client = await getClient();

    const state = await buildState(bucketName, inputConfig, s3Client);

    if (outputPath) {
      const absoluteOutputPath = path.resolve(outputPath);
      const directory = path.dirname(absoluteOutputPath);

      try {
        await fs.access(directory);
      } catch {
        await fs.mkdir(directory, { recursive: true });
      }

      await fs.writeFile(
        absoluteOutputPath,
        JSON.stringify(state, null, 2),
        "utf8"
      );
      logger.info(ansis.green(`State written to ${absoluteOutputPath}`));
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("An unknown error occurred.");
    }
    process.exit(1);
  }
};
