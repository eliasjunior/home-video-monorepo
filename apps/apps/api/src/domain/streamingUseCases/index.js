import fs from "fs";
import { logE } from "../../common/MessageUtil";

export default {
  createStream: function ({ fileAbsPath, start, end }) {
    try {
      if (Number.isInteger(start)) {
        return fs.createReadStream(fileAbsPath, { start, end });
      } else {
        return fs.createReadStream(fileAbsPath);
      }
    } catch (error) {
      logE(`Attempting to stream file path ${fileAbsPath} has failed`, error);
      throw error;
    }
  },
};


