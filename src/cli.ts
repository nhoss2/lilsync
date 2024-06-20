import { Command } from "commander";

import { run } from "./run";
import { checkState } from "./check";

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
  .action(async () => {
    await checkState();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
