import path from "path";
import type { S3Client } from "@aws-sdk/client-s3";
import ansis from "ansis";
import Bottleneck from "bottleneck";
import sharp from "sharp";
import ExifParser from "exif-parser";

import { logger } from "./logger";
import { deleteImage, downloadImage, getClient, uploadImage } from "./s3";
import {
  type Ext,
  type ImageToCreate,
  type InputConfig,
  type OutputImageConfig,
  type State,
  supportedFileTypes,
} from "./types";

const limiter = new Bottleneck({
  maxConcurrent: 15,
});

type ImageWithMetadata = {
  imageBuffer: Buffer;
  metadata: sharp.Metadata;
  exifCreated?: number | null;
};
const downloadImageAndGetMetadata = async (
  bucketName: string,
  key: string,
  s3Client: S3Client
): Promise<ImageWithMetadata | null> => {
  try {
    const imageBuffer = await downloadImage(bucketName, key, s3Client);
    const metadata = await sharp(imageBuffer).metadata(); // Throws an error if not a valid image
    const exifCreated = await parseExifData(imageBuffer);
    return { imageBuffer, metadata, exifCreated };
  } catch (error) {
    logger.error(`Error processing image for key ${key}: %o`, error);
    return null;
  }
};

const processAndUploadImage = async (
  inputBaseKey: string,
  inputImageData: ImageWithMetadata,
  outputConfigs: OutputImageConfig[],
  bucketName: string,
  outputPath: string,
  s3Client: S3Client
) => {
  for (const outputConfig of outputConfigs) {
    const { width, height, ext = "jpeg", quality = 85 } = outputConfig;

    let processedImage;
    const { metadata, imageBuffer, exifCreated } = inputImageData;

    if (
      (width !== undefined && metadata.width! > width) ||
      (height !== undefined && metadata.height! > height)
    ) {
      processedImage = sharp(imageBuffer)
        .resize(width, height)
        .toFormat(ext, { quality });
    } else {
      processedImage = sharp(imageBuffer).toFormat(ext, { quality });
    }

    const processedImageBuffer = await processedImage.toBuffer();
    const outputMetadata = await sharp(processedImageBuffer).metadata();

    if (
      outputMetadata.width === undefined ||
      outputMetadata.height === undefined
    )
      return;

    const outputKey = path.join(
      outputPath,
      `${inputBaseKey}_${outputMetadata.width}x${outputMetadata.height}.${outputMetadata.format}`
    );

    const fileMetadata: Record<string, string> = {
      width: outputMetadata.width.toString(),
      height: outputMetadata.height.toString(),
    };

    if (exifCreated) {
      fileMetadata.created = String(exifCreated);
    }

    logger.info(ansis.gray(`output: ${outputKey}`));

    await uploadImage(
      bucketName,
      outputKey,
      processedImageBuffer,
      s3Client,
      fileMetadata
    );
  }
};

const fileExtSupported = (imgKey: string) => {
  const fileExtension = path.extname(imgKey).toLowerCase().slice(1);

  return supportedFileTypes.includes(fileExtension as Ext);
};

const processImage = async (
  inputBaseKey: string,
  imagesToCreate: ImageToCreate[],
  InputConfig: InputConfig,
  bucketName: string
) => {
  const inputKey = imagesToCreate[0].inputKey;

  if (!fileExtSupported(inputKey)) {
    logger.warn(`skipping non-image file: ${inputKey}`);
    return null;
  }

  const s3Client = await getClient();

  const inputImageData = await downloadImageAndGetMetadata(
    bucketName,
    inputKey,
    s3Client
  );
  if (inputImageData === null) {
    return null;
  }

  // TODO: handle input images that are smaller than output images. in that case
  // the output images wont get created but for each run it will download the
  // image to look at dimensions

  const outputConfigs = imagesToCreate.map((i) => i.config);

  await processAndUploadImage(
    inputBaseKey,
    inputImageData,
    outputConfigs,
    bucketName,
    InputConfig.outputPath,
    s3Client
  );

  return inputKey;
};

export const processImages = async (
  state: State,
  inputConfig: InputConfig,
  bucketName: string
): Promise<State> => {
  const { imagesToCreate } = state;

  const imageBaseNames = Object.keys(imagesToCreate);
  const imageProcessingTasks = imageBaseNames.map((baseName, index) =>
    limiter.schedule(() => {
      const processWithLog = async () => {
        logger.info(
          `${index + 1}/${imageBaseNames.length}: processing key ${
            imagesToCreate[baseName][0].inputKey
          }`
        );
        return processImage(
          baseName,
          imagesToCreate[baseName],
          inputConfig,
          bucketName
        );
      };
      return processWithLog();
    })
  );

  await Promise.all(imageProcessingTasks);

  return state;
};

export const deleteUnmatchedImages = async (
  bucketName: string,
  unmatchedOutputImageKeys: string[]
) => {
  const s3Client = await getClient();

  for (const unmatchedOutputImageKey of unmatchedOutputImageKeys) {
    await deleteImage(bucketName, unmatchedOutputImageKey, s3Client);
  }
};

const parseExifData = async (imgData: Buffer): Promise<number | null> => {
  try {
    const parser = ExifParser.create(imgData);
    const result = parser.parse();

    return (result.tags.DateTimeOriginal || result.tags.CreateDate) ?? null;
  } catch (err) {
    return null;
  }
};
