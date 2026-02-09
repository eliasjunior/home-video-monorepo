//OBS: It's not using anymore, now it use nginx to serve the app see nginx.conf
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static("./build"));

app.get("/*", (_, res) => {
  _log("*** React local server running **** ");
  _log("Base path " + path.join(__dirname));
  res.sendFile(path.join(__dirname, "./build", "index.html"));
});
const port = process.env.PORT || 9000;

app.listen(port, () => {
  _log("Application started. Listening on port:" + port);
});

function _log() {
  if (process.env.NODE_ENV !== "test") {
    console.log("Log " + getLogDate(), arguments[0]);
  }
}
function getLogDate() {
  let date = new Date();
  return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}
