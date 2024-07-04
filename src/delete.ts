import ansis from "ansis";
import { confirm } from "@inquirer/prompts";

import { logger } from "./logger";
import { getConfig } from "./config";
import { deleteFilesBulk, getClient, listBucketObjects } from "./s3";

export const deletePath = async (
  path: string,
  showFiles?: boolean,
  force?: boolean
) => {
  const config = getConfig();
  const { bucketName } = config;

  const s3Client = await getClient();

  const objectsToDelete = await listBucketObjects(bucketName, s3Client, path);

  if (objectsToDelete.length === 0) {
    logger.info("No files to delete for that path");
    return;
  }

  logger.info("Number of items to delete %o", objectsToDelete.length);

  if (showFiles) {
    for (const objectToDelete of objectsToDelete) {
      logger.info(ansis.gray(` - ${objectToDelete}`));
    }
  }

  if (!force) {
    const confirmDeletion = await confirm({
      message: `Are you sure you want to delete ${objectsToDelete.length} items?`,
    });

    if (!confirmDeletion) {
      logger.info("Deletion aborted by the user.");
      return;
    }
  }

  try {
    await deleteFilesBulk(bucketName, objectsToDelete);
    logger.info(ansis.green("Done!"));
  } catch (error) {
    logger.error("Error occurred while deleting files:", error);
  }
};
