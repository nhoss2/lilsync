import { Command } from "commander";

import { checkState } from "./check";
import { run } from "./run";

const program = new Command();

program
  .command("run")
  .description("process all images")
  .action(async () => {
    await run();
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

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
