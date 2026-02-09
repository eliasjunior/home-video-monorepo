import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { getMovieImgPath } from "./Presenter";
import "./video.css";
import { DialogList } from "components/common/DialogList";
import { getBlobUrl } from "services/Api";
import config from "config";

export default function Poster({ video, onSetVideo, isSeries }) {
  const { SERVER_URL } = config();
  const [displayEp, setDisplayEp] = useState(false);
  const [imgSrc, setImgSrc] = useState("");
  const { id, name, fileIds, img } = video;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const pathOrUrl = getMovieImgPath(id, isSeries, img);
    const fallbackSrc = `${SERVER_URL}/public/movie_fallback.png`;

    if (pathOrUrl.indexOf("http") !== -1) {
      setImgSrc(pathOrUrl);
      return () => {};
    }

    (async () => {
      try {
        if (pathOrUrl.startsWith("public/")) {
          setImgSrc(`${SERVER_URL}/${pathOrUrl}`);
          return;
        }
        objectUrl = await getBlobUrl(pathOrUrl);
        if (active) setImgSrc(objectUrl);
      } catch (err) {
        if (active) setImgSrc(fallbackSrc);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isSeries, img]);
  
  return (
    <div className="media-box" onClick={() => setDisplayEp(!displayEp)}>
      <div className="media-box__img-box">
        {isSeries ? (
          <img
            className="media-box__img-box--ext"
            key={id}
            alt="Series poster"
            src={imgSrc}
          ></img>
        ) : (
          <img
            onClick={() => onSetVideo(id, isSeries)}
            className="media-box__img-box--ext"
            key={id}
            alt="Movie poster"
            src={imgSrc}
          ></img>
        )}
        <div className="media-box__img-box--title"> {name}</div>
      </div>

      {isSeries && displayEp ? (
        <DialogList
          list={fileIds}
          onAction={onSetVideo}
          parentId={id}
        ></DialogList>
      ) : (
        ""
      )}
    </div>
  );
}

Poster.propTypes = {
  video: PropTypes.object.isRequired,
  onSetVideo: PropTypes.func,
  isSeries: PropTypes.bool,
};
