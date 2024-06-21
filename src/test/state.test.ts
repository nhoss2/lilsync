import {
  collectProcessedImages,
  collectInputImages,
  getNewImages,
  findUnmatchedImages,
  getPartialProcessedImages,
} from "../state";
import type {
  InputConfig,
  ProcessedImageMap,
  InputImageMap,
  ImagesToCreate,
} from "../types";
import { logger } from "../logger";

jest.mock("../s3", () => ({
  ...jest.requireActual("../s3"),
  listBucketObjects: jest.fn(),
}));

describe("collectProcessedImages", () => {
  it("should collect processed images", () => {
    const allFileKeys = [
      "pub/folder1/image1_2500x2000.jpeg",
      "pub/folder1/image2_2500x2000.jpeg",
      "pub/image3_2500x2000.jpeg",
      "pub/image3_2000x1000.jpeg",
      "pub/something_2000x1000.jpeg",
      "images/something.png",
    ];
    const config: InputConfig = {
      inputPath: "images/",
      outputPath: "pub/",
      outputImages: [],
    };

    const inputBaseNames = {
      something: {
        key: "images/something.png",
      },
    };

    const expected = {
      "folder1/image1": [
        {
          key: "pub/folder1/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
      ],
      "folder1/image2": [
        {
          key: "pub/folder1/image2_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
      ],
      image3: [
        {
          key: "pub/image3_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
        {
          key: "pub/image3_2000x1000.jpeg",
          metadata: { width: 2000, height: 1000 },
          sourceKey: undefined,
        },
      ],
      something: [
        {
          key: "pub/something_2000x1000.jpeg",
          metadata: { width: 2000, height: 1000 },
          sourceKey: "images/something.png",
        },
      ],
    };

    const result = collectProcessedImages(allFileKeys, inputBaseNames, config);
    expect(result).toEqual(expected);
  });
});

describe("collectInputBaseKeys", () => {
  it("should collect input base keys", () => {
    const allFileKeys = [
      "images/folder1/image1.jpg",
      "images/folder1/image2.jpg",
      "images/image3.jpg",
    ];
    const config: InputConfig = {
      inputPath: "images/",
      outputPath: "pub/",
      outputImages: [],
    };

    const expected = {
      "folder1/image1": {
        key: "images/folder1/image1.jpg",
      },
      "folder1/image2": {
        key: "images/folder1/image2.jpg",
      },
      image3: {
        key: "images/image3.jpg",
      },
    };

    const result = collectInputImages(allFileKeys, config);
    expect(result).toEqual(expected);
  });
});

describe("getNewImages", () => {
  let config: InputConfig;
  let inputBaseNames: InputImageMap;
  let publishedBaseNames: ProcessedImageMap;
  let imagesToCreate: ImagesToCreate;

  beforeEach(() => {
    config = {
      outputPath: "pub/",
      inputPath: "images/",
      outputImages: [
        { width: 2500, quality: 95 },
        { width: 1000, quality: 80 },
        { height: 1500, quality: 70 },
      ],
    };

    inputBaseNames = {
      image1: { key: "images/image1.jpg" },
      image2: { key: "images/image2.png" },
      image3: { key: "images/image3.tif" },
      image4: { key: "images/image4.gif" },
    };

    publishedBaseNames = {
      image2: [
        {
          key: "pub/image2_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
        },
        {
          key: "pub/image2_1000x800.jpeg",
          metadata: { width: 1000, height: 800 },
        },
      ],
    };

    imagesToCreate = {};
  });

  test("should add new images to imagesToCreate", () => {
    getNewImages(config, inputBaseNames, publishedBaseNames, imagesToCreate);

    expect(imagesToCreate).toEqual({
      image1: [
        { config: { width: 2500, quality: 95 }, inputKey: "images/image1.jpg" },
        { config: { width: 1000, quality: 80 }, inputKey: "images/image1.jpg" },
        {
          config: { height: 1500, quality: 70 },
          inputKey: "images/image1.jpg",
        },
      ],
      image3: [
        { config: { width: 2500, quality: 95 }, inputKey: "images/image3.tif" },
        { config: { width: 1000, quality: 80 }, inputKey: "images/image3.tif" },
        {
          config: { height: 1500, quality: 70 },
          inputKey: "images/image3.tif",
        },
      ],
      image4: [
        { config: { width: 2500, quality: 95 }, inputKey: "images/image4.gif" },
        { config: { width: 1000, quality: 80 }, inputKey: "images/image4.gif" },
        {
          config: { height: 1500, quality: 70 },
          inputKey: "images/image4.gif",
        },
      ],
    });
  });

  test("should handle case where imagesToCreate already has entries", () => {
    imagesToCreate["image1"] = [
      { config: { width: 1000, quality: 80 }, inputKey: "images/image1.jpg" },
    ];

    getNewImages(config, inputBaseNames, publishedBaseNames, imagesToCreate);

    expect(imagesToCreate["image1"]).toHaveLength(3);
    expect(imagesToCreate["image1"]).toEqual([
      { config: { width: 1000, quality: 80 }, inputKey: "images/image1.jpg" },
      { config: { width: 2500, quality: 95 }, inputKey: "images/image1.jpg" },
      { config: { height: 1500, quality: 70 }, inputKey: "images/image1.jpg" },
    ]);
  });

  test("should not add configurations that already exist in imagesToCreate", () => {
    imagesToCreate["image1"] = [
      { config: { width: 2500, quality: 95 }, inputKey: "images/image1.jpg" },
    ];

    getNewImages(config, inputBaseNames, publishedBaseNames, imagesToCreate);

    expect(imagesToCreate["image1"]).toHaveLength(3);
    expect(imagesToCreate["image1"]).toEqual([
      { config: { width: 2500, quality: 95 }, inputKey: "images/image1.jpg" },
      { config: { width: 1000, quality: 80 }, inputKey: "images/image1.jpg" },
      { config: { height: 1500, quality: 70 }, inputKey: "images/image1.jpg" },
    ]);
    expect(imagesToCreate["image1"][0].config.width).toBe(2500);
    expect(imagesToCreate["image1"][1].config.width).toBe(1000);
    expect(imagesToCreate["image1"][2].config.height).toBe(1500);
  });

  test("should handle images with no output configurations needing processing", () => {
    publishedBaseNames = {
      image1: [
        {
          key: "pub/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
        },
        {
          key: "pub/image1_1000x800.jpeg",
          metadata: { width: 1000, height: 800 },
        },
        {
          key: "pub/image1_1500x1500.jpeg",
          metadata: { width: 1500, height: 1500 },
        },
      ],
    };

    getNewImages(config, inputBaseNames, publishedBaseNames, imagesToCreate);

    expect(imagesToCreate["image1"]).toBeUndefined();
  });
});

describe("findUnmatchedImages", () => {
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(logger, "error")
      .mockImplementation((infoObject: object) => logger);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it("should find no unmatched images when all images have matching input images", () => {
    const publishedBaseNames: ProcessedImageMap = {
      image1: [
        {
          key: "pub/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: "images/image1.jpg",
        },
        {
          key: "pub/image1_1500x1500.jpeg",
          metadata: { width: 1500, height: 1500 },
          sourceKey: "images/image1.jpg",
        },
      ],
      image2: [
        {
          key: "pub/image2_1000x1000.jpeg",
          metadata: { width: 1000, height: 1000 },
          sourceKey: "images/image2.png",
        },
      ],
    };

    const result = findUnmatchedImages(publishedBaseNames);
    expect(result).toEqual([]);
  });

  it("should find unmatched images when there are images without matching input images", () => {
    const publishedBaseNames: ProcessedImageMap = {
      image1: [
        {
          key: "pub/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
        {
          key: "pub/image1_1500x1500.jpeg",
          metadata: { width: 1500, height: 1500 },
          sourceKey: undefined,
        },
      ],
      image2: [
        {
          key: "pub/image2_1000x1000.jpeg",
          metadata: { width: 1000, height: 1000 },
          sourceKey: "images/image2.png",
        },
      ],
    };

    const result = findUnmatchedImages(publishedBaseNames);
    expect(result).toEqual([
      "pub/image1_2500x2000.jpeg",
      "pub/image1_1500x1500.jpeg",
    ]);
  });

  it("should handle cases where there are inconsistent source keys", () => {
    const publishedBaseNames: ProcessedImageMap = {
      image1: [
        {
          key: "pub/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: "images/image1.jpg",
        },
        {
          key: "pub/image1_1500x1500.jpeg",
          metadata: { width: 1500, height: 1500 },
          sourceKey: "images/image1_different.jpg",
        },
      ],
    };

    const result = findUnmatchedImages(publishedBaseNames);
    expect(logger.error).toHaveBeenCalledWith(
      "there shouldnt be more than 1 unique sourceKey for a published image set. source keys: ",
      new Set(["images/image1.jpg", "images/image1_different.jpg"])
    );
    expect(result).toEqual([]);
  });

  it("should handle cases where there are no source keys", () => {
    const publishedBaseNames: ProcessedImageMap = {
      image1: [
        {
          key: "pub/image1_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
        {
          key: "pub/image1_1500x1500.jpeg",
          metadata: { width: 1500, height: 1500 },
          sourceKey: undefined,
        },
      ],
      image2: [
        {
          key: "pub/image2_2500x2000.jpeg",
          metadata: { width: 2500, height: 2000 },
          sourceKey: undefined,
        },
      ],
    };

    const result = findUnmatchedImages(publishedBaseNames);
    expect(result).toEqual([
      "pub/image1_2500x2000.jpeg",
      "pub/image1_1500x1500.jpeg",
      "pub/image2_2500x2000.jpeg",
    ]);
  });
});

describe("getPartialProcessedImages", () => {
  test("no processed images, single output config", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [{ width: 250, height: 250 }],
    };
    const processedImages: ProcessedImageMap = {};
    const expected: ImagesToCreate = {};

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("one processed image, one missing config", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [
        { width: 250, height: 250 },
        { width: 500, height: 500 },
      ],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_250x250.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 250, height: 250 },
        },
      ],
    };
    const expected: ImagesToCreate = {
      image1: [
        { config: { width: 500, height: 500 }, inputKey: "input/image1.png" },
      ],
    };

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("multiple processed images, all configs present", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [{ width: 250, height: 250 }, { width: 500 }],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_250x250.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 250, height: 250 },
        },
        {
          key: "output/image1_500x500.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 500, height: 500 },
        },
      ],
    };
    const expected: ImagesToCreate = {};

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("multiple images with some missing configs", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [{ width: 250 }, { height: 500 }],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_250x250.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 250, height: 250 },
        },
      ],
      image2: [
        {
          key: "output/image2_500x500.jpeg",
          sourceKey: "input/image2.jpg",
          metadata: { width: 500, height: 500 },
        },
      ],
    };
    const expected: ImagesToCreate = {
      image1: [{ config: { height: 500 }, inputKey: "input/image1.png" }],
      image2: [{ config: { width: 250 }, inputKey: "input/image2.jpg" }],
    };

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("image with more than required dimensions", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [{ width: 250, height: 250 }],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_1000x1000.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 1000, height: 1000 },
        },
      ],
    };
    const expected: ImagesToCreate = {
      image1: [
        { config: { width: 250, height: 250 }, inputKey: "input/image1.png" },
      ],
    };

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("multiple output configurations with missing images", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [{ width: 250 }, { width: 500 }, { width: 750 }],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_250x250.jpeg",
          sourceKey: "input/image1.jpeg",
          metadata: { width: 250, height: 250 },
        },
      ],
      image2: [
        {
          key: "output/image2_500x500.jpeg",
          sourceKey: "input/image2.jpeg",
          metadata: { width: 500, height: 500 },
        },
      ],
    };
    const expected: ImagesToCreate = {
      image1: [
        { config: { width: 500 }, inputKey: "input/image1.jpeg" },
        { config: { width: 750 }, inputKey: "input/image1.jpeg" },
      ],
      image2: [
        { config: { width: 250 }, inputKey: "input/image2.jpeg" },
        { config: { width: 750 }, inputKey: "input/image2.jpeg" },
      ],
    };

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });

  test("no output config provided", () => {
    const config: InputConfig = {
      inputPath: "input/",
      outputPath: "output/",
      outputImages: [],
    };
    const processedImages: ProcessedImageMap = {
      image1: [
        {
          key: "output/image1_250x250.jpeg",
          sourceKey: "input/image1.png",
          metadata: { width: 250, height: 250 },
        },
      ],
    };
    const expected: ImagesToCreate = {};

    const result = getPartialProcessedImages(config, processedImages);
    expect(result).toEqual(expected);
  });
});
