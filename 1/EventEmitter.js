const EventEmitter = require("events");
const emitter = new EventEmitter();

emitter.on("message logged", function (args) {
  console.log("listener called", args);
});

emitter.emit("message logged", { id: 1, message: "message" });
