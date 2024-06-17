export const supportedFileTypes = [
  "avif",
  "dz",
  "fits",
  "gif",
  "heif",
  "input",
  "jpeg",
  "jpg",
  "jp2",
  "jxl",
  "magick",
  "openslide",
  "pdf",
  "png",
  "ppm",
  "raw",
  "svg",
  "tiff",
  "tif",
  "v",
  "webp",
] as const;

export type Ext = (typeof supportedFileTypes)[number];

export interface State {
  config: InputConfig;
  imagesToCreate: ImagesToCreate;
  unmatchedOutputImages: string[]; // output images that have been processed but their corresponding input image has been since removed
  publishedBaseNames: ProcessedImageMap;
  inputBaseNames: InputImageMap;
}

export interface OutputImageConfig {
  width?: number;
  height?: number;
  ext?: Ext;
  quality?: number;
}

export interface InputConfig {
  outputPath: string;
  inputPath: string;
  outputImages: OutputImageConfig[];
}

interface ImageMetadata {
  width: number;
  height: number;
}

export interface ProcessedImage {
  key: string;
  sourceKey?: string;
  metadata: ImageMetadata;
  config?: OutputImageConfig;
}

export interface ImageToCreate {
  inputKey: string;
  config: OutputImageConfig;
}

export interface ImagesToCreate {
  [inputBaseKey: string]: ImageToCreate[];
}

export type ProcessedImageMap = {
  [inputBaseKey: string]: ProcessedImage[];
};

export type InputImageMap = {
  [inputBaseKey: string]: {
    key: string;
  };
};
