#!/usr/bin/env node

import { Command } from "commander";

import { checkState } from "./check";
import { run } from "./run";
import { deletePath } from "./delete";
import { uploadPath } from "./file";

const program = new Command();

program
  .command("run")
  .description("process all images")
  .option(
    "--delete",
    "Delete output images that dont have a matching input image"
  )
  .action(async (options: { delete?: boolean }) => {
    const { delete: deleteUnmatched } = options;
    await run(deleteUnmatched);
  });

program
  .command("check")
  .description(
    "check how many images have been processed and need to be processed"
  )
  .option(
    "-O, --output <file_location>",
    "Specify the file path where a state file will be saved"
  )
  .action(async (options: { output?: string }) => {
    const { output } = options;
    await checkState(output);
  });

program
  .command("upload <src> <dest>")
  .option("-s, --show-files", "show files")
  .option("-f, --force", "skip confirmation")
  .description(
    "upload all files from src directory to dest in the remote bucket"
  )
  .action(
    async (
      src: string,
      dest: string,
      options: { showFiles?: boolean; force?: boolean }
    ) => {
      const { showFiles, force } = options;
      await uploadPath(src, dest, { showFiles, force });
    }
  );

program
  .command("delete <path>")
  .option("-s, --show-files", "show files")
  .option("-f, --force", "skip confirmation")
  .description(
    "delete all files in the configured bucket based on the input path"
  )
  .action(
    async (path: string, options: { showFiles?: boolean; force?: boolean }) => {
      const { showFiles, force } = options;
      await deletePath(path, showFiles, force);
    }
  );

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
