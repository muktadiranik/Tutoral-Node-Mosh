const logger = require("./logger.js");

logger.log("This is a log message.");
console.log(logger.add(5, 3));
console.log(logger.sub(5, 3));
console.log(logger.mul(5, 3));
console.log(logger.div(5, 3));
console.log(logger.url);

// OS Module
const os = require("os");
console.log("Operating System Info:");
console.log("Platform:", os.platform());
console.log("Total Memory", os.totalmem());
console.log("Available Memory", os.freemem());
console.log("Load Average", os.loadavg());

// Path Module
const path = require("path");
console.log("Path Info:");
console.log("File Info:", path.parse(__filename));
console.log("Directory Name:", path.dirname(__filename));
console.log("Base Name:", path.basename(__filename));
console.log("Extension Name:", path.extname(__filename));
console.log("Parsed Path:", path.parse(__filename));
console.log("Joined Path:", path.join(__dirname, "test", "file.txt"));

const Logger = logger.printLogger;
const printLogger = new Logger();
printLogger.log("message");
