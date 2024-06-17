import path from "path";
import sharp from "sharp";
import Bottleneck from "bottleneck";
import { S3Client } from "@aws-sdk/client-s3";

import {
  State,
  InputConfig,
  OutputImageConfig,
  ImageToCreate,
  supportedFileTypes,
  Ext,
} from "./types";
import { downloadImage, uploadImage, getClient, deleteImage } from "./s3";

const limiter = new Bottleneck({
  maxConcurrent: 15,
});

type ImageWithMetadata = {
  imageBuffer: Buffer;
  metadata: sharp.Metadata;
};
const downloadImageAndGetMetadata = async (
  bucketName: string,
  key: string,
  s3Client: S3Client
): Promise<ImageWithMetadata | null> => {
  try {
    const imageBuffer = await downloadImage(bucketName, key, s3Client);
    const metadata = await sharp(imageBuffer).metadata(); // Throws an error if not a valid image
    return { imageBuffer, metadata };
  } catch (error) {
    console.error(`Error processing image for key ${key}:`, error);
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
    const { metadata, imageBuffer } = inputImageData;

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

    const outputKey = path.join(
      outputPath,
      `${inputBaseKey}_${outputMetadata.width}x${outputMetadata.height}.${outputMetadata.format}`
    );

    console.log("output:", outputKey);

    await uploadImage(
      bucketName,
      outputKey,
      processedImageBuffer,
      s3Client,
      outputMetadata.width!,
      outputMetadata.height!
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
  console.log("processing key:", inputKey);

  if (!fileExtSupported(inputKey)) {
    console.warn(`skipping non-image file: ${inputKey}`);
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

  const imageProcessingTasks = Object.keys(imagesToCreate).map((baseName) =>
    limiter.schedule(() =>
      processImage(baseName, imagesToCreate[baseName], inputConfig, bucketName)
    )
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
