import ansis from "ansis";
import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.printf(({ level, message }) => {
      let coloredMessage = message;
      if (level === "info") {
        coloredMessage = ansis.white(message);
      } else if (level === "warn") {
        coloredMessage = ansis.yellow(message);
      } else if (level === "error") {
        coloredMessage = ansis.red(message);
      }
      return `${coloredMessage}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
