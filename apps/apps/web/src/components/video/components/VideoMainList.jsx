import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./videoMainList.css";
import { getPosters } from "./Presenter";
import Loading from "../../common/Loading";
import Footer from "components/footer/Footer";
import Header from "components/header/Header";
import PosterList from "./PosterList";
import { MOVIE_CATEG, SERIES_CATEG } from "common/constants";
import { HAS_ERROR } from "main/Reducer";

function VideoMainList({ history, dispatch }) {
  const [movieMap, setMovieMap] = useState({});
  const [allMovieIds, setAllMovieIds] = useState([]);
  const [allSeriesIds, setAllSeriesIds] = useState([]);
  const [seriesMap, setSeriesMap] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [query, setQuery] = useState(MOVIE_CATEG);

  useEffect(() => {
    if (query === MOVIE_CATEG) {
      fetchMovies();
    } else {
      fetchSeries();
    }
  }, [query]);

  async function fetchMovies() {
    try {
      const { allIds, byId, error } = await getPosters();
      if (!error) {
        // order matters https://reactjs.org/docs/hooks-rules.html
        setMovieMap(byId);
        setAllMovieIds(allIds);
      } else {
        dispatch({ type: HAS_ERROR, payload: error });
      }
    } catch (err) {
      dispatch({ type: HAS_ERROR, payload: "Error fetching the data" });
    }
  }

  async function fetchSeries() {
    try {
      const { allIds, byId, error } = await getPosters(true);
      if (!error) {
        // order matters https://reactjs.org/docs/hooks-rules.html
        setSeriesMap(byId);
        setAllSeriesIds(allIds);
      } else {
        dispatch({ type: HAS_ERROR, payload: error });
      }
    } catch (err) {
      dispatch({ type: HAS_ERROR, payload: "Error fetching the data" });
    }
  }

  const setUpMovie = (movieId, isSeries = false) => {
    history.push(
      `/display/${movieId}/${isSeries ? SERIES_CATEG : MOVIE_CATEG}`
    );
  };

  return allMovieIds.length === 0 ? (
    <Loading></Loading>
  ) : (
    <div style={{ minHeight: "inherit" }}>
      <Header
        onChangeSearch={(ev) => {
          setSearchValue(ev.target.value);
        }}
        onFilterCat={(value) => setQuery(value)}
        history={history}
      ></Header>
      <div className="player-list">
        {query === MOVIE_CATEG ? (
          <PosterList
            ids={allMovieIds}
            videoMap={movieMap}
            searchValue={searchValue}
            onSetVideo={setUpMovie}
          ></PosterList>
        ) : (
          <PosterList
            ids={allSeriesIds}
            videoMap={seriesMap}
            searchValue={searchValue}
            isSeries={true}
            onSetVideo={setUpMovie}
          ></PosterList>
        )}
        <Footer></Footer>
      </div>
    </div>
  );
}

export default VideoMainList;

VideoMainList.propTypes = {
  history: PropTypes.object.isRequired,
  dispatch: PropTypes.func.isRequired,
};
