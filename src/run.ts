import { getClient } from "./s3";
import { buildState } from "./state";
import { processImages, deleteUnmatchedImages } from "./image";
import { getConfig } from "./config";

export const run = async (): Promise<void> => {
  try {
    const config = getConfig();
    const { bucketName, inputConfig } = config;

    const s3Client = await getClient();

    console.log("building state");

    const state = await buildState(bucketName, inputConfig, s3Client);

    console.log("processing images");

    await processImages(state, inputConfig, bucketName);

    if (state.unmatchedOutputImages.length > 0) {
      console.log("deleting unmatched output images");
      await deleteUnmatchedImages(bucketName, state.unmatchedOutputImages);
    }

    console.log("done!");
  } catch (err) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error("An unknown error occurred.");
    }
    process.exit(1);
  }
};
