lilsync
=======

lilsync is a tool that takes images from an s3 compatible cloud storage, creates optimised/resized versions of those images and reuploads them. Uses [Sharp](https://github.com/lovell/sharp) for converting images.

Get Started
-----------

Install:
```
npm install -g lilsync
```

Then create a config file in your home directory called `.lilsyncrc.yaml`.

Config
------
lilsync requires a config file called `.lilsyncrc.yaml` either in the current directory or in your home directory.

An example config file is as follows:
```yaml
bucketName: milkyway
credentials:
  accessKeyId: abc
  secretKey: def
  endpointUrl: https://s3.somewhere.tld
inputConfig:
  outputPath: out/
  inputPath: images/
  outputImages:
    - width: 1250
      quality: 95
    - width: 500
      quality: 95
      ext: png
```

- bucketName: string representing the bucket where images will be stored
- credentials: s3 compatible credentials. Instead of providing this section you can also have the following environment variables: `ACCESS_KEY_ID`, `SECRET_KEY` and `ENDPOINT_URL`
- inputConfig:
    - outputPath: all images created by lilsync will be put in this folder. it doesnt have to exist in the bucket
    - inputPath: lilsync will look inside this folder and find images to convert
    - outputImages: a list of the formats you want to be created. all images from the input folder will have a new image created in the output folder for each format in this section. Requires at least a `width` or `height` to be defined. Each format can have the following keys:
        - `width`: number in pixels
        - `height`: numebr in pixels
        - `quality`: number 1 - 100 (default 85)
        - `ext`: string representing the output file format (default jpeg)

Commands
--------

`lilsync run`: process all images

`lilsync check`: print out the state.

`lilsync upload <src> <dst>` upload all files from source to destination in a given bucket.

`lilsync delete <path>`: delete all files from the given path in the bucket.
