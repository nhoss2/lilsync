import { S3Client } from "@aws-sdk/client-s3";

import type {
  State,
  InputConfig,
  ProcessedImage,
  ProcessedImageMap,
  InputImageMap,
  ImagesToCreate,
} from "./types";
import {
  getBaseKeyFromInputKey,
  getBaseKeyFromPublishedKey,
  findOutputConfig,
  findSourceKey,
} from "./key";
import { listBucketObjects } from "./s3";

export const collectInputImages = (
  allFileKeys: string[],
  config: InputConfig
) => {
  const inputBaseKeys: InputImageMap = {};

  allFileKeys.forEach((key) => {
    if (key.startsWith(config.inputPath)) {
      const baseKey = getBaseKeyFromInputKey(key, config);
      if (baseKey !== null) {
        if (baseKey in inputBaseKeys) {
          // TODO: test
          console.warn(
            `multiple input keys with the base name (excluding file extension). ignoring: ${key}`
          );
        } else {
          inputBaseKeys[baseKey] = { key };
        }
      }
    }
  });

  return inputBaseKeys;
};

export const getNewImages = (
  config: InputConfig,
  inputBaseNames: InputImageMap,
  publishedBaseNames: ProcessedImageMap,
  imagesToCreate: ImagesToCreate
) => {
  for (const [baseName, { key: inputKey }] of Object.entries(inputBaseNames)) {
    if (baseName in publishedBaseNames) {
      continue;
    }

    for (const outputImgConfig of config.outputImages) {
      const configExists = imagesToCreate[baseName]?.some((existingConf) => {
        return (
          existingConf.config.height === outputImgConfig.height &&
          existingConf.config.width === outputImgConfig.width
        );
      });

      if (!configExists) {
        if (!(baseName in imagesToCreate)) {
          imagesToCreate[baseName] = [];
        }
        imagesToCreate[baseName].push({
          config: outputImgConfig,
          inputKey,
        });
      }
    }
  }
  return imagesToCreate;
};

export const findUnmatchedImages = (publishedBaseNames: ProcessedImageMap) => {
  let unmatchedImageKeys: string[] = [];
  for (const processedImages of Object.values(publishedBaseNames)) {
    const inputKeys = new Set(processedImages.map((img) => img.sourceKey));

    if (inputKeys.size !== 1) {
      console.error(
        "there shouldnt be more than 1 unique sourceKey for a published image set. source keys: ",
        inputKeys
      );
      continue;
    }

    const singleValue = Array.from(inputKeys)[0];
    const unmatchedOutputKeys = processedImages.map((img) => img.key);
    if (singleValue === undefined) {
      unmatchedImageKeys = [...unmatchedImageKeys, ...unmatchedOutputKeys];
    }
  }

  return unmatchedImageKeys;
};

export const getPartialProcessedImages = (
  config: InputConfig,
  processedImages: ProcessedImageMap
) => {
  config.outputImages.forEach(({ width, height }) => {
    if (!width && !height) {
      throw new Error(
        "Invalid output configuration: width or height must be specified"
      );
    }
  });

  const toCreate: ImagesToCreate = {};

  for (const [baseKey, imgs] of Object.entries(processedImages)) {
    const uniqueSourceKeys = new Set(imgs.map((img) => img.sourceKey));
    const inputKey =
      uniqueSourceKeys.size === 1 ? imgs[0].sourceKey : undefined;

    if (inputKey === undefined) {
      console.warn("unable to find input key for imgs: ", imgs);
      continue;
    }

    // check if all the imgs match all the input configs
    for (const outConf of config.outputImages) {
      let availableImgDimensions = imgs.map((img) => {
        return { width: img.metadata?.width, height: img.metadata?.height };
      });

      if (outConf.width) {
        availableImgDimensions = availableImgDimensions.filter((dimension) => {
          return dimension.width === outConf.width;
        });
      }
      if (outConf.height) {
        availableImgDimensions = availableImgDimensions.filter((dimension) => {
          return dimension.height === outConf.height;
        });
      }

      if (availableImgDimensions.length === 0) {
        if (!(baseKey in toCreate)) {
          toCreate[baseKey] = [];
        }
        toCreate[baseKey].push({
          config: outConf,
          inputKey,
        });
      }
    }
  }

  return toCreate;
};

export const collectProcessedImages = (
  allFileKeys: string[],
  inputBaseNames: InputImageMap,
  config: InputConfig
) => {
  const processedImages: ProcessedImageMap = {};

  allFileKeys.forEach((key) => {
    if (key.startsWith(config.outputPath)) {
      const parsedKey = getBaseKeyFromPublishedKey(key, config);

      if (parsedKey === null) return;

      const { baseKey, dimensions } = parsedKey;

      if (baseKey) {
        const imgConfig = findOutputConfig(
          config.outputImages,
          dimensions.width,
          dimensions.height
        );

        const sourceKey = findSourceKey(baseKey, inputBaseNames);

        const processedImage: ProcessedImage = {
          key,
          metadata: dimensions,
          config: imgConfig ?? undefined,
          sourceKey,
        };

        if (!processedImages[baseKey]) {
          processedImages[baseKey] = [];
        }
        processedImages[baseKey].push(processedImage);
      }
    }
  });

  return processedImages;
};

export const buildState = async (
  bucketName: string,
  config: InputConfig,
  s3Client: S3Client
): Promise<State> => {
  const allFileKeys = await listBucketObjects(bucketName, s3Client);

  console.log(`number of files: ${allFileKeys.length}`);

  const inputBaseNames = collectInputImages(allFileKeys, config);

  console.log(`input images ${Object.keys(inputBaseNames).length}`);

  const publishedBaseNames = collectProcessedImages(
    allFileKeys,
    inputBaseNames,
    config
  );

  const numOutputImages = Object.values(publishedBaseNames).reduce(
    (num, curr) => {
      return num + curr.length;
    },
    0
  );
  console.log(`output images already created: ${numOutputImages}`);

  const unmatchedOutputImages = findUnmatchedImages(publishedBaseNames);

  console.log(`unmatched output images: ${unmatchedOutputImages.length}`);

  const missedImagesToCreate = getPartialProcessedImages(
    config,
    publishedBaseNames
  );

  const imagesToCreate = getNewImages(
    config,
    inputBaseNames,
    publishedBaseNames,
    missedImagesToCreate
  );

  const numImagesToCreate = Object.values(imagesToCreate).reduce(
    (num, current) => {
      return num + current.length;
    },
    0
  );

  console.log(`images to create: ${numImagesToCreate}`);

  return {
    config,
    imagesToCreate,
    unmatchedOutputImages,
    publishedBaseNames,
    inputBaseNames,
  };
};
