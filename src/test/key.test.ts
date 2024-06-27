import {
  findOutputConfig,
  getBaseKeyFromInputKey,
  getBaseKeyFromPublishedKey,
  parseDimensionsFromKey,
} from "../key";
import type { InputConfig, OutputImageConfig } from "../types";

describe("getBaseKeyFromInputKey", () => {
  const config: InputConfig = {
    outputPath: "pub/",
    inputPath: "images/",
    outputImages: [{ width: 2500, quality: 95 }],
  };

  const testCases = [
    {
      key: "images/folder1/folder2/image.jpg",
      expected: "folder1/folder2/image",
    },
    {
      key: "images/image.jpg",
      expected: "image",
    },
    {
      key: "images/a/b/c/d/e/f/g/h/i/j/image.jpg",
      expected: "a/b/c/d/e/f/g/h/i/j/image",
    },
    {
      key: "noinputpath/image.jpg",
      expected: null,
    },
    {
      key: "images/folder#1/folder-2/image@.jpg",
      expected: "folder#1/folder-2/image@",
    },
    {
      key: "images/folder with spaces/image with spaces.jpg",
      expected: "folder with spaces/image with spaces",
    },
    {
      key: "images/folder1/image.png",
      expected: "folder1/image",
    },
  ];

  testCases.forEach(({ key, expected }) => {
    it(`should return the base key for ${key}`, () => {
      const baseKey = getBaseKeyFromInputKey(key, config);
      expect(baseKey).toBe(expected);
    });
  });
});

describe("getBaseKeyFromPublishedKey", () => {
  const config: InputConfig = {
    outputPath: "pub/",
    inputPath: "images/",
    outputImages: [{ width: 2500, quality: 95 }],
  };

  const testCases = [
    {
      key: "pub/folder1/folder2/image_300x200.jpg",
      expected: {
        baseKey: "folder1/folder2/image",
        dimensions: { width: 300, height: 200 },
      },
    },
    {
      key: "pub/image_1920x1080.png",
      expected: {
        baseKey: "image",
        dimensions: { width: 1920, height: 1080 },
      },
    },
    {
      key: "pub/a/b/c/d/e/f/g/h/i/j/image_1024x768.webp",
      expected: {
        baseKey: "a/b/c/d/e/f/g/h/i/j/image",
        dimensions: { width: 1024, height: 768 },
      },
    },
    {
      key: "pub/no_dimensions/image.jpg",
      expected: null,
    },
    {
      key: "pub/folder#1/folder-2/image@_512x512.jpg",
      expected: {
        baseKey: "folder#1/folder-2/image@",
        dimensions: { width: 512, height: 512 },
      },
    },
    {
      key: "pub/folder with spaces/image with spaces_1280x720.jpg",
      expected: {
        baseKey: "folder with spaces/image with spaces",
        dimensions: { width: 1280, height: 720 },
      },
    },
    {
      key: "pub/folder1/image_400x300.png",
      expected: {
        baseKey: "folder1/image",
        dimensions: { width: 400, height: 300 },
      },
    },
    {
      key: "pub/images/pub/sample_with_multiple_underscores_1024x768.jpg",
      expected: {
        baseKey: "images/pub/sample_with_multiple_underscores",
        dimensions: { width: 1024, height: 768 },
      },
    },
  ];

  testCases.forEach(({ key, expected }) => {
    it(`should return the base key and dimensions for ${key}`, () => {
      const result = getBaseKeyFromPublishedKey(key, config);
      expect(result).toEqual(expected);
    });
  });
});

describe("findOutputConfig", () => {
  const outputConfigs: OutputImageConfig[] = [
    { width: 800, height: 600, ext: "jpeg", quality: 80 },
    { width: 1024, height: 768, ext: "png", quality: 90 },
    { width: 1920, height: 1080, ext: "webp", quality: 75 },
  ];

  it("should return the correct config when both width and height match", () => {
    const config = findOutputConfig(outputConfigs, 800, 600);
    expect(config).toEqual({
      width: 800,
      height: 600,
      ext: "jpeg",
      quality: 80,
    });
  });

  it("should return null if no config matches the width and height", () => {
    const config = findOutputConfig(outputConfigs, 1280, 720);
    expect(config).toBeNull();
  });

  it("should return null if multiple configs match the width and height", () => {
    const multipleMatchConfigs: OutputImageConfig[] = [
      { width: 1024, height: 768, ext: "jpeg", quality: 85 },
      { width: 1024, height: 768, ext: "png", quality: 90 },
    ];
    const config = findOutputConfig(multipleMatchConfigs, 1024, 768);
    expect(config).toBeNull();
  });

  it("matches configs when only width or height match", () => {
    const outputConfigs: OutputImageConfig[] = [
      { width: 1000 },
      { height: 200 },
    ];
    const config = findOutputConfig(outputConfigs, 1000, 350);
    expect(config).toEqual({ width: 1000 });

    const config2 = findOutputConfig(outputConfigs, 400, 200);
    expect(config2).toEqual({ height: 200 });
  });
});

describe("parseDimensionsFromKey", () => {
  const testCases = [
    { key: "path/to/image_800x600.png", expected: { width: 800, height: 600 } },
    {
      key: "another/path/to/image_name__test_1024x768.jpg",
      expected: { width: 1024, height: 768 },
    },
    { key: "invalid/path/to/image_nodimensions.jpg", expected: null },
    { key: "no_dimensions.png", expected: null },
    {
      key: "random/file_with_1920x1080.png",
      expected: { width: 1920, height: 1080 },
    },
    { key: "edgecase_/badfile_33xwrongxformat", expected: null },
  ];
  testCases.forEach(({ key, expected }) => {
    test(`should parse dimensions correctly for key: ${key}`, () => {
      const result = parseDimensionsFromKey(key);
      expect(result).toEqual(expected);
    });
  });
});
