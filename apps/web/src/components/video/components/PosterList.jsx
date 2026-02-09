import React from "react";
import PropTypes from "prop-types";
import Poster from "./Poster";

export default function PosterList({
  ids,
  videoMap,
  searchValue,
  onSetVideo,
  isSeries,
}) {
  return (
    <div className="list-content">
      {ids
        .filter((id) => {
          const movie = videoMap[id];
          return searchValue === ""
            ? true
            : movie.name.toUpperCase().includes(searchValue.toUpperCase());
        })
        .map((id) => (
          <Poster
            video={videoMap[id]}
            key={id}
            onSetVideo={onSetVideo}
            isSeries={isSeries}
          ></Poster>
        ))}
    </div>
  );
}

PosterList.propTypes = {
  ids: PropTypes.array.isRequired,
  videoMap: PropTypes.object.isRequired,
  searchValue: PropTypes.string,
  onSetVideo: PropTypes.func.isRequired,
  isSeries: PropTypes.bool,
};
