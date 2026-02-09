const hbjs = require("handbrake-js"); // its not working, just download the client
const fs = require("fs");
const CONFIG_FILE = "config.json";
const path = require("path");

function getFilesFromFolder(videosLocation) {
  const items = fs.readdirSync(videosLocation);
  return items.filter((name) => name !== ".DS_Store");
}

function converter(file, path) {
  console.log(`---- Converting --> ${file}`);
  console.log(new Date().toString());

  hbjs
    .spawn({ input: `${path}/${file}`, output: `${path}/${file}-copy.mp4` })
    .on("error", (err) => {
      // invalid user input, no video found etc
      console.log("problem to convert the file", err);
    })
    .on("progress", (progress) => {
      console.log(
        "Percent complete: %s, ETA: %s",
        progress.percentComplete,
        progress.eta
      );
    })
    .on("end", () => {
      console.log(`COMPLETED!`);
      console.log(`##################################`);
      console.log(new Date().toString());
    });
}

function fileExtEqual(fileName) {
  return path.extname(fileName).toLowerCase();
}

function main() {
  const FILE_EXT = ".mkv";
  console.log(fileExtEqual(FILE_EXT));
  const config = JSON.parse(fs.readFileSync(`./${CONFIG_FILE}`));
  const path = `${config.sourceBaseLocation}/${config.videoSource}/`;
  const files = getFilesFromFolder(path).filter((file) => {
    return fileExtEqual(file) === FILE_EXT;
  });
  console.log("Files to Convert", files);
  for (let index = 0; index < files.length; index++) {
    const video = files[index];
    converter(video, path);
  }
}
main();
