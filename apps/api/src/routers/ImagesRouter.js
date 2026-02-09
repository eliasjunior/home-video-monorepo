import express from "express";
import { getMovieMap, getSeriesMap } from "../common/Util";
import { imgProvider } from "./RouterUtil";
import config from "../config";
const { moviesDir, seriesDir } = config();

const router = express.Router();

router.get("/images/:id", getImgFromMovie);
router.get("/images/series/:id", getImgFromSeries);

function getImgFromSeries(req, response) {
  const { id } = req.params;

  const seriesMap = getSeriesMap();
  const { name, img } = seriesMap.byId[id];

  let binImg = imgProvider({ id, name, img, folder: seriesDir });

  response.write(binImg, "binary");
  response.end(null, "binary");
}
function getImgFromMovie(req, response) {
  const { id } = req.params;

  const MovieMap = getMovieMap();
  const { name, img } = MovieMap.byId[id];

  let binImg = imgProvider({ id, name, img, folder: moviesDir });

  response.write(binImg, "binary");
  response.end(null, "binary");
}

export default router;
