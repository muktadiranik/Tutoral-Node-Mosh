const EventEmitter = require("events");
const emitter = new EventEmitter();


emitter.addListener("message logged", function () {
    console.log("listener called");
});

emitter.emit("message logged");