import fs from "fs";
import path from "path";
import { logE, logD } from "../common/MessageUtil";
import { DEFAULT_ENCODING } from "../common/AppServerConstant";

export default function FileLib() {
  return {
    readFileInfo: function (fullPath) {
      //get file info, size
      return fs.statSync(`${fullPath}`);
    },
    readDirectory: function (folderLocation) {
      try {
        return fs.readdirSync(folderLocation, { withFileTypes: true });
      } catch (err) {
        logE("Unable to scan directory: " + err);
        logD(`No directories found into ${folderLocation}`);
      }
      return [];
    },
    readFile: function (fileUrl, encoding = DEFAULT_ENCODING) {
      if (encoding === "none") {
        return fs.readFileSync(fileUrl);
      } else {
        return fs.readFileSync(fileUrl, encoding);
      }
    },
    isDirExist: function (folderPath) {
      try {
        fs.accessSync(folderPath, fs.constants.R_OK | fs.constants.F_OK);
        return true;
      } catch (err) {
        logE(`${folderPath} does not exist or cannot access it`, err);
        return false;
      }
    },
    fileExtEqual: function (fileName) {
      return path.extname(fileName).toLowerCase();
    },
    readJson: function (data) {
      try {
        const jsonObject = JSON.parse(data);
        logD("Parsed JSON object:", jsonObject);
        return jsonObject;
      } catch (parseError) {
        logE("Error parsing JSON:", parseError);
      }
    },
  };
}
