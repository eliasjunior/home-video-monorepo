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
import { getSharedVideoFiles } from "../../../services/auth";
import config from "../../../config";

function VideoMainList({ history, dispatch }) {
  const [movieMap, setMovieMap] = useState({});
  const [allMovieIds, setAllMovieIds] = useState([]);
  const [allSeriesIds, setAllSeriesIds] = useState([]);
  const [seriesMap, setSeriesMap] = useState({});
  const [searchValue, setSearchValue] = useState("");
  const [query, setQuery] = useState(MOVIE_CATEG);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [nextcloudVideos, setNextcloudVideos] = useState([]);

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
    async function loadData() {
      // Fetch Nextcloud videos first
      const ncVideos = await fetchNextcloudVideos();
      setNextcloudVideos(ncVideos);

      // Then fetch movies or series, passing Nextcloud videos directly
      if (query === MOVIE_CATEG) {
        await fetchMovies(ncVideos);
      } else {
        await fetchSeries();
      }
    }

    loadData();
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

  // Poll Nextcloud for new shares every 30 seconds if authenticated
  useEffect(() => {
    const nextcloudAuthEnabled = sessionStorage.getItem('nextcloud_auth_enabled') === 'true';
    const hasNextcloudCredentials = sessionStorage.getItem('nextcloud_username') &&
                                     sessionStorage.getItem('nextcloud_app_password');

    if (!nextcloudAuthEnabled || !hasNextcloudCredentials) {
      return;
    }

    console.log('[VideoMainList] Starting Nextcloud polling for new shares');

    const pollInterval = setInterval(async () => {
      try {
        const username = sessionStorage.getItem('nextcloud_username');
        const appPassword = sessionStorage.getItem('nextcloud_app_password');

        console.log('[VideoMainList] Polling Nextcloud for share updates');

        const { SERVER_URL } = config();
        const response = await fetch(`${SERVER_URL}/videos/nextcloud/shares?username=${encodeURIComponent(username)}&appPassword=${encodeURIComponent(appPassword)}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const newShares = await response.json();
          const currentShares = sessionStorage.getItem('nextcloud_videos');

          // Only update if shares have changed
          if (currentShares !== JSON.stringify(newShares)) {
            console.log('[VideoMainList] Nextcloud shares updated, refreshing list');
            sessionStorage.setItem('nextcloud_videos', JSON.stringify(newShares));

            // Refresh the video list to show new Nextcloud shares
            if (query === MOVIE_CATEG) {
              fetchMovies();
            }
          }
        }
      } catch (error) {
        console.error('[VideoMainList] Error polling Nextcloud:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => {
      console.log('[VideoMainList] Stopping Nextcloud polling');
      clearInterval(pollInterval);
    };
  }, [query, fetchMovies]);

  async function fetchNextcloudVideos() {
    const nextcloudEnabled = sessionStorage.getItem('nextcloud_auth_enabled') === 'true';
    if (!nextcloudEnabled) {
      console.log('[VideoMainList] Nextcloud integration not enabled');
      return [];
    }

    try {
      const username = sessionStorage.getItem('nextcloud_username');
      const appPassword = sessionStorage.getItem('nextcloud_app_password');

      if (!username || !appPassword) {
        console.log('[VideoMainList] No Nextcloud credentials found');
        return [];
      }

      console.log('[VideoMainList] Fetching Nextcloud shared videos...');
      const result = await getSharedVideoFiles({ username, appPassword });

      if (result.success && result.files) {
        console.log(`[VideoMainList] Found ${result.files.length} shared videos from Nextcloud`);
        // Store in sessionStorage for Player to access
        sessionStorage.setItem('nextcloud_videos', JSON.stringify(result.files));
        return result.files;
      } else {
        console.error('[VideoMainList] Failed to fetch Nextcloud videos:', result.error);
        return [];
      }
    } catch (err) {
      console.error('[VideoMainList] Error fetching Nextcloud videos:', err);
      return [];
    }
  }

  async function fetchMovies(ncVideos = []) {
    setIsLoading(true);
    try {
      const { allIds, byId, error } = await getPosters();
      if (!error) {
        // Merge local videos with Nextcloud shared videos
        const mergedById = { ...byId };
        const mergedAllIds = [...allIds];

        // Add Nextcloud videos to the map (use parameter, not state)
        const videosToMerge = ncVideos.length > 0 ? ncVideos : nextcloudVideos;
        console.log(`[VideoMainList] Merging ${videosToMerge.length} Nextcloud videos with ${allIds.length} local videos`);

        videosToMerge.forEach((ncVideo) => {
          const videoId = `nextcloud-${ncVideo.fileId}`;
          // Extract filename from path or use fileName field directly
          const fileName = ncVideo.fileName || ncVideo.path || ncVideo.file_target || 'Unknown';
          const displayTitle = fileName.replace(/^\//, '').split('/').pop(); // Get just the filename without path

          console.log(`[VideoMainList] Processing Nextcloud video:`, {
            fileId: ncVideo.fileId,
            fileName: ncVideo.fileName,
            path: ncVideo.path,
            displayTitle
          });

          mergedById[videoId] = {
            id: videoId,
            title: displayTitle,
            folder: `Shared by ${ncVideo.ownerDisplayName || ncVideo.owner || 'Unknown'}`,
            isNextcloudShare: true,
            nextcloudData: ncVideo,
            // Use Nextcloud file URL for streaming
            fileName: fileName
          };
          mergedAllIds.push(videoId);
        });

        console.log(`[VideoMainList] Total videos after merge: ${mergedAllIds.length}`);

        // order matters https://reactjs.org/docs/hooks-rules.html
        setMovieMap(mergedById);
        setAllMovieIds(mergedAllIds);
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
