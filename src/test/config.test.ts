import { cosmiconfigSync } from "cosmiconfig";

import { getConfig, getCredentials, validateConfig } from "../config";

jest.mock("cosmiconfig");
jest.mock("dotenv");

describe("Config Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("validateConfig", () => {
    const validConfig = {
      bucketName: "test-bucket",
      inputConfig: {
        outputPath: "/output/path",
        inputPath: "/input/path",
        outputImages: [{ width: 1000, height: 2000, ext: "png", quality: 90 }],
      },
    };

    const invalidConfigs = [
      {
        case: "missing bucketName",
        config: {
          inputConfig: {
            outputPath: "/output/path",
            inputPath: "/input/path",
            outputImages: [
              { width: 1000, height: 2000, ext: "png", quality: 90 },
            ],
          },
        },
      },
      {
        case: "duplicate dimensions",
        config: {
          bucketName: "test-bucket",
          inputConfig: {
            outputPath: "/output/path",
            inputPath: "/input/path",
            outputImages: [
              { width: 1000, height: 2000, ext: "png", quality: 90 },
              { width: 1000, height: 3000, ext: "jpg", quality: 80 },
            ],
          },
        },
      },
    ];

    test("should validate a valid config", () => {
      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    test.each(invalidConfigs)("should throw error for $case", ({ config }) => {
      expect(() => validateConfig(config)).toThrow(Error);
    });
  });

  describe("getCredentials", () => {
    const envCredentials = {
      ACCESS_KEY_ID: "env-access-key-id",
      SECRET_KEY: "env-secret-key",
      ENDPOINT_URL: "env-endpoint-url",
    };

    const configCredentials = {
      accessKeyId: "config-access-key-id",
      secretKey: "config-secret-key",
      endpointUrl: "config-endpoint-url",
    };

    const testCases = [
      {
        description:
          "if both config and env credentials are provided, use config credentials",
        env: envCredentials,
        config: configCredentials,
        expected: configCredentials,
      },
      {
        description:
          "if only env credentials are provided, use env credentials",
        env: envCredentials,
        config: {},
        expected: {
          accessKeyId: "env-access-key-id",
          secretKey: "env-secret-key",
          endpointUrl: "env-endpoint-url",
        },
      },
      {
        description:
          "if only config credentials are provided, use config credentials",
        env: {},
        config: configCredentials,
        expected: configCredentials,
      },
    ];

    test.each(testCases)(
      "should return correct credentials $description",
      ({ env, config, expected }) => {
        process.env = { ...env };
        const result = getCredentials(config);
        expect(result).toEqual(expected);
      }
    );
  });

  describe("getConfig", () => {
    const validConfig = {
      config: {
        bucketName: "test-bucket",
        inputConfig: {
          outputPath: "/output/path",
          inputPath: "/input/path",
          outputImages: [
            { width: 1000, height: 2000, ext: "png", quality: 90 },
          ],
        },
        credentials: {
          accessKeyId: "config-access-key-id",
          secretKey: "config-secret-key",
          endpointUrl: "config-endpoint-url",
        },
      },
    };

    const cosmiconfigMock = cosmiconfigSync as jest.Mock;

    test("should return parsed config if everything is valid", () => {
      cosmiconfigMock.mockReturnValue({
        search: jest.fn().mockReturnValue(validConfig),
      });

      const result = getConfig();
      expect(result).toEqual({
        ...validConfig.config,
      });
    });

    test("should throw error if config file is not found or empty", () => {
      cosmiconfigMock.mockReturnValue({
        search: jest.fn().mockReturnValue(null),
      });

      expect(() => getConfig()).toThrow(
        "configuration file not found or is empty"
      );
    });

    test("should throw validation error with formatted message", () => {
      const invalidConfig = {
        config: {
          bucketName: 12345, // Invalid type
          inputConfig: {
            outputPath: "/output/path",
            inputPath: "/input/path",
            outputImages: [
              { width: 1000, height: 2000, ext: "png", quality: 101 }, // Invalid quality
            ],
          },
        },
      };

      cosmiconfigMock.mockReturnValue({
        search: jest.fn().mockReturnValue(invalidConfig),
      });

      try {
        getConfig();
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toContain("Configuration validation error:");
        }
      }
    });
  });
});
