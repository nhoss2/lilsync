import winston from "winston";
import chalk from "chalk";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.printf(({ level, message }) => {
      let coloredMessage = message;
      if (level === "info") {
        coloredMessage = chalk.white(message);
      } else if (level === "warn") {
        coloredMessage = chalk.yellow(message);
      } else if (level === "error") {
        coloredMessage = chalk.red(message);
      }
      return `${coloredMessage}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
