import path from "path";

import type { InputConfig, OutputImageConfig, InputImageMap } from "./types";

export const getBaseKeyFromInputKey = (
  key: string,
  config: InputConfig
): string | null => {
  if (!key.startsWith(config.inputPath)) {
    return null;
  }

  const relativePath = path.relative(config.inputPath, key);
  const parsedPath = path.parse(relativePath);
  const baseKey = path.join(parsedPath.dir, parsedPath.name);

  return baseKey;
};

export const getBaseKeyFromPublishedKey = (
  key: string,
  config: InputConfig
): {
  baseKey: string;
  dimensions: { width: number; height: number };
} | null => {
  const parsedKey = path.parse(key);
  const dimensions = parseDimensionsFromKey(key);

  if (dimensions !== null) {
    const relativePath = path.relative(config.outputPath, parsedKey.dir);
    const nameParts = parsedKey.name.split("_");
    nameParts.pop(); // Remove the dimensions part
    const baseName = nameParts.join("_");
    const baseKey = path.join(relativePath, baseName);
    return {
      baseKey,
      dimensions,
    };
  }

  return null;
};

export const parseDimensionsFromKey = (
  key: string
): { width: number; height: number } | null => {
  const parsedKey = path.parse(key);
  const nameParts = parsedKey.name.split("_");
  const dimensions = nameParts.pop();

  if (dimensions && dimensions.includes("x")) {
    const [width, height] = dimensions.split("x").map(Number);

    if (
      width !== undefined &&
      !isNaN(width) &&
      height !== undefined &&
      !isNaN(height)
    ) {
      return { width, height };
    }
  }
  return null;
};

export const findOutputConfig = (
  outputConfigs: OutputImageConfig[],
  width: number,
  height: number
) => {
  let availableConfigs = outputConfigs.filter((outputConfig) => {
    if (outputConfig.width !== undefined) {
      return outputConfig.width === width;
    }
    return true;
  });

  availableConfigs = availableConfigs.filter((outputConfig) => {
    if (outputConfig.height !== undefined) {
      return outputConfig.height === height;
    }
    return true;
  });

  if (availableConfigs.length === 1) {
    return availableConfigs[0];
  }
  return null;
};

export const findSourceKey = (
  baseKey: string,
  inputBaseNames: InputImageMap
) => {
  return inputBaseNames[baseKey]?.key;
};
