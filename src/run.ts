import { getConfig } from "./config";
import { processImages } from "./image";
import { logger } from "./logger";
import { getClient, deleteFilesBulk } from "./s3";
import { buildState } from "./state";

export const run = async (): Promise<void> => {
  try {
    const config = getConfig();
    const { bucketName, inputConfig } = config;

    const s3Client = await getClient();

    const state = await buildState(bucketName, inputConfig, s3Client);

    logger.info("processing images");

    await processImages(state, inputConfig, bucketName);

    if (state.unmatchedOutputImages.length > 0) {
      logger.info("deleting unmatched output images");
      await deleteFilesBulk(bucketName, state.unmatchedOutputImages);
    }

    logger.info("done!");
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err.message);
    } else {
      logger.error("An unknown error occurred.");
    }
    process.exit(1);
  }
};
