import type { Readable } from "stream";
import Bottleneck from "bottleneck";
import ansis from "ansis";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type {
  GetObjectCommandOutput,
  ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";

import { getConfig } from "./config";
import { logger } from "./logger";

export const createS3Client = (
  accessKeyId: string,
  secretAccessKey: string,
  endpointUrl: string
): S3Client => {
  return new S3Client({
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    endpoint: endpointUrl,
    region: "auto",
    maxAttempts: 10,
  });
};

export const getClient = async () => {
  const config = getConfig();
  const { accessKeyId, secretKey, endpointUrl } = config.credentials!;
  return createS3Client(accessKeyId, secretKey, endpointUrl);
};

export const listBucketObjects = async (
  bucketName: string,
  s3Client: S3Client,
  prefix?: string
): Promise<string[]> => {
  const allObjects: string[] = [];
  let isTruncated = true;
  let continuationToken: string | undefined = undefined;

  while (isTruncated) {
    try {
      const params = {
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      };

      const data: ListObjectsV2CommandOutput = await s3Client.send(
        new ListObjectsV2Command(params)
      );

      if (data.Contents) {
        const keys = data.Contents.map((obj) => obj.Key).filter(
          (key): key is string => key !== undefined
        );
        allObjects.push(...keys);
      }

      isTruncated = data.IsTruncated ?? false;
      continuationToken = data.NextContinuationToken;
    } catch (err) {
      logger.error("Error listing bucket objects:", err);
      break;
    }
  }

  return allObjects;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

export const downloadImage = async (
  bucketName: string,
  key: string,
  s3Client: S3Client
): Promise<Buffer> => {
  try {
    const params = { Bucket: bucketName, Key: key };
    const data: GetObjectCommandOutput = await s3Client.send(
      new GetObjectCommand(params)
    );

    if (!data.Body) {
      throw new Error(`No data found for key: ${key}`);
    }

    return streamToBuffer(data.Body as Readable);
  } catch (error) {
    logger.error(`Error downloading image for key ${key}:`, error);
    throw error;
  }
};

export const uploadImage = async (
  bucketName: string,
  key: string,
  body: Buffer,
  s3Client: S3Client,
  metadata: Record<string, string>,
  contentType: string | undefined
): Promise<void> => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    Metadata: metadata,
    ContentType: contentType,
  };

  await s3Client.send(new PutObjectCommand(params));
};

export const deleteFilesBulk = async (
  bucketName: string,
  fileKeys: string[]
) => {
  const limiter = new Bottleneck({
    maxConcurrent: 25,
  });
  const deleteTasks = fileKeys.map((fileKey, index) =>
    limiter.schedule(() => {
      const deleteWithLog = async () => {
        logger.info(
          ansis.gray(`${index + 1}/${fileKeys.length}: deleting key ${fileKey}`)
        );
        const s3Client = await getClient();
        return await deleteFile(bucketName, fileKey, s3Client);
      };

      return deleteWithLog();
    })
  );

  await Promise.all(deleteTasks);
};

export const deleteFile = async (
  bucketName: string,
  key: string,
  s3Client: S3Client
) => {
  const deleteParams = {
    Bucket: bucketName,
    Key: key,
  };

  const command = new DeleteObjectCommand(deleteParams);
  await s3Client.send(command);
};
