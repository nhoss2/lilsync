import { S3Client } from "@aws-sdk/client-s3";

import { getClient } from "./s3";
import { buildState } from "./state";
import { getConfig } from "./config";
import { logger } from "./logger";

export const checkState = async (): Promise<void> => {
  try {
    const config = getConfig();
    const { bucketName, inputConfig } = config;

    const s3Client: S3Client = await getClient();

    await buildState(bucketName, inputConfig, s3Client);
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("An unknown error occurred.");
    }
    process.exit(1);
  }
};
