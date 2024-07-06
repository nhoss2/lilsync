import * as fs from "fs/promises";
import ansis from "ansis";
import { confirm } from "@inquirer/prompts";
import { glob } from "glob";

import { logger } from "./logger";
import { getConfig } from "./config";
import { uploadFilesBulk } from "./s3";

type UploadPathOptions = {
  force?: boolean;
  showFiles?: boolean;
};

export const uploadPath = async (
  src: string,
  dest: string,
  options: UploadPathOptions
) => {
  const { force = false, showFiles = false } = options;
  const config = getConfig();
  const { bucketName } = config;

  const { filePaths, totalSize } = await findFilesAndSize(src);

  if (filePaths.length === 0) {
    logger.info("No files to upload from that path");
    return;
  }

  logger.info("Number of items to upload: %o", filePaths.length);
  logger.info("Total size to upload: %s", formatBytes(totalSize));

  if (showFiles) {
    for (const filePath of filePaths) {
      logger.info(ansis.gray(` - ${filePath}`));
    }
  }

  if (!force) {
    const confirmUpload = await confirm({
      message: `Are you sure you want to upload ${
        filePaths.length
      } items (${formatBytes(totalSize)})?`,
    });

    if (!confirmUpload) {
      logger.info("Upload aborted by the user.");
      return;
    }
  }

  try {
    await uploadFilesBulk(bucketName, src, dest, filePaths);
    logger.info(ansis.green("Done!"));
  } catch (error) {
    logger.error("Error occurred while uploading files:", error);
  }
};

async function findFilesAndSize(
  src: string
): Promise<{ filePaths: string[]; totalSize: number }> {
  const filePaths = await glob("**/*", {
    cwd: src,
    nodir: true,
    absolute: true,
  });

  let totalSize = 0;
  await Promise.all(
    filePaths.map(async (filePath) => {
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
    })
  );

  return { filePaths, totalSize };
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
