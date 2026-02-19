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
import { useWebSocket } from "../../../hooks/useWebSocket";
import { getCurrentUser } from "../../../services/Api";

function VideoMainList({ history, dispatch }) {
  const [movieMap, setMovieMap] = useState({});
  const [allMovieIds, setAllMovieIds] = useState([]);
  const [allSeriesIds, setAllSeriesIds] = useState([]);
  const [seriesMap, setSeriesMap] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [query, setQuery] = useState(MOVIE_CATEG);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch current user on mount
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        console.log('[VideoMainList] Current user:', user.username);
      } catch (err) {
        console.error('[VideoMainList] Error fetching current user:', err);
      }
    }
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (query === MOVIE_CATEG) {
      fetchMovies();
    } else {
      fetchSeries();
    }
  }, [query]);

  // WebSocket connection for real-time updates
  useWebSocket({
    onMessage: (data) => {
      if (data.type === 'file-change') {
        console.log('[VideoMainList] File change detected:', data.data);

        // Filter by username in multi-user mode
        if (currentUser && data.data.username && data.data.username !== currentUser.username) {
          console.log(`[VideoMainList] Ignoring event for different user: ${data.data.username}`);
          return;
        }

        // Refresh the appropriate list based on the category
        if (data.data.category === 'movies' && query === MOVIE_CATEG) {
          console.log('[VideoMainList] Refreshing movies list');
          fetchMovies();
        } else if (data.data.category === 'series' && query === SERIES_CATEG) {
          console.log('[VideoMainList] Refreshing series list');
          fetchSeries();
        }
      }
    },
    onConnect: () => {
      console.log('[VideoMainList] WebSocket connected');
    },
    onDisconnect: () => {
      console.log('[VideoMainList] WebSocket disconnected');
    }
  });

  async function fetchMovies() {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSeries() {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }

  const setUpMovie = (movieId, isSeries = false) => {
    history.push(
      `/display/${movieId}/${isSeries ? SERIES_CATEG : MOVIE_CATEG}`
    );
  };

  if (isLoading) {
    return <Loading></Loading>;
  }

  return (
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
          allMovieIds.length === 0 ? (
            <div style={{ color: "white", padding: "20px", textAlign: "center" }}>
              No videos found
            </div>
          ) : (
            <PosterList
              ids={allMovieIds}
              videoMap={movieMap}
              searchValue={searchValue}
              onSetVideo={setUpMovie}
            ></PosterList>
          )
        ) : (
          allSeriesIds.length === 0 ? (
            <div style={{ color: "white", padding: "20px", textAlign: "center" }}>
              No series found
            </div>
          ) : (
            <PosterList
              ids={allSeriesIds}
              videoMap={seriesMap}
              searchValue={searchValue}
              isSeries={true}
              onSetVideo={setUpMovie}
            ></PosterList>
          )
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
