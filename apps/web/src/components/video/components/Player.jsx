import React, { useState, useEffect, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import "./player.css";
import Loading from "components/common/Loading";
import { SERIES_CATEG } from "common/constants";
import { getTrackPath, getVideoPath, loadVideo } from "./Player.presenter";
import { getBlobUrl } from "services/Api";
import { HAS_ERROR } from "main/Reducer";
import { useHistory } from "react-router-dom";
import config from "config";

function Player({ match, dispatch }) {
  const { SERVER_URL } = config();
  const history = useHistory();
  const [media, setMedia] = useState(undefined);
  const [videoSrc, setVideoSrc] = useState("");
  const [trackSrc, setTrackSrc] = useState("");
  const { params } = match;
  const videoRef = useRef(null);
  const lastSavedRef = useRef(0);
  const saveProgress = useCallback(
    async (positionSeconds, durationSeconds) => {
      try {
        await fetch(`${SERVER_URL}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            videoId: params.id,
            positionSeconds,
            durationSeconds,
          }),
        });
      } catch (err) {
        // non-blocking
      }
    },
    [SERVER_URL, params.id]
  );

  const computeResumeTime = (data, durationFromEl) => {
    if (!data?.positionSeconds) return null;
    const duration =
      (Number.isFinite(durationFromEl) && durationFromEl > 0
        ? durationFromEl
        : Number(data.durationSeconds || 0)) || 0;
    if (duration && data.positionSeconds >= duration - 3) {
      return 0;
    }
    return data.positionSeconds;
  };
  const onErrorHandle = () => {
    dispatch({ type: HAS_ERROR, payload: undefined });
  };

  useEffect(() => {
    let active = true;
    const fetchMovie = async () => {
      try {
        // Check if this is a Nextcloud video by looking at the ID
        if (params.id && params.id.startsWith('nextcloud-')) {
          console.log('[Player] Detected Nextcloud video ID:', params.id);
          // Load from sessionStorage instead of backend
          const nextcloudVideosJson = sessionStorage.getItem('nextcloud_videos');
          if (nextcloudVideosJson) {
            const nextcloudVideos = JSON.parse(nextcloudVideosJson);
            const fileId = params.id.replace('nextcloud-', '');
            const ncVideo = nextcloudVideos.find(v => String(v.fileId) === String(fileId));

            if (ncVideo) {
              // Reconstruct the media object with Nextcloud data
              const videoId = `nextcloud-${ncVideo.fileId}`;
              const mediaObj = {
                id: videoId,
                title: ncVideo.fileName.replace(/^\//, ''),
                folder: `Shared by ${ncVideo.ownerDisplayName}`,
                name: ncVideo.fileName.split('/').pop(),
                isNextcloudShare: true,
                fileId: ncVideo.fileId,
                nextcloudData: ncVideo
              };
              console.log('[Player] Loaded Nextcloud video from sessionStorage:', mediaObj);
              if (active) setMedia(mediaObj);
              return;
            }
          }
          console.error('[Player] Nextcloud video not found in sessionStorage');
          dispatch({ type: HAS_ERROR, payload: "Nextcloud video not found" });
          return;
        }

        // Load regular video from backend
        const resp = await loadVideo(params.id, params.type === SERIES_CATEG);
        if (active) setMedia(resp);
      } catch (error) {
        dispatch({ type: HAS_ERROR, payload: undefined });
      }
    };
    fetchMovie();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!media) return () => {};
    let active = true;
    let videoUrl = "";
    let trackUrl = "";

    (async () => {
      try {
        console.log('[Player] Loading media:', media);
        console.log('[Player] media.isNextcloudShare:', media.isNextcloudShare);

        // Handle Nextcloud videos differently
        if (media.isNextcloudShare) {
          console.log('[Player] Loading Nextcloud video:', media);
          // Get Nextcloud credentials from sessionStorage
          const username = sessionStorage.getItem('nextcloud_username');
          const appPassword = sessionStorage.getItem('nextcloud_app_password');

          if (!username || !appPassword) {
            dispatch({ type: HAS_ERROR, payload: "Nextcloud credentials not found" });
            return;
          }

          // Get stored Nextcloud videos data
          const nextcloudVideosJson = sessionStorage.getItem('nextcloud_videos');
          let nextcloudVideos = [];
          if (nextcloudVideosJson) {
            try {
              nextcloudVideos = JSON.parse(nextcloudVideosJson);
            } catch (e) {
              console.error('[Player] Error parsing Nextcloud videos:', e);
            }
          }

          // Find the video data by fileId
          const fileId = media.fileId || (media.id && media.id.replace('nextcloud-', ''));
          const videoData = nextcloudVideos.find(v => String(v.fileId) === String(fileId));

          if (!videoData) {
            console.error('[Player] Nextcloud video data not found for fileId:', fileId);
            dispatch({ type: HAS_ERROR, payload: "Nextcloud video data not found" });
            return;
          }

          console.log('[Player] Found Nextcloud video data:', videoData);

          // Use fileName as it contains the WebDAV file path (file_target from Nextcloud API)
          const filePath = videoData.fileName;

          if (!filePath) {
            console.error('[Player] No file path found in video data');
            dispatch({ type: HAS_ERROR, payload: "Nextcloud video path not found" });
            return;
          }

          // Construct proxy URL with credentials as query params
          const streamUrl = `${SERVER_URL}/videos/nextcloud/${fileId}/stream?username=${encodeURIComponent(username)}&appPassword=${encodeURIComponent(appPassword)}&filePath=${encodeURIComponent(filePath)}`;

          console.log('[Player] Nextcloud proxy stream URL:', streamUrl);

          if (active) {
            setVideoSrc(streamUrl);
            setTrackSrc("");
          }
        } else {
          // Handle local videos (existing logic)
          videoUrl = await getBlobUrl(
            getVideoPath({ mediaType: params.type, media })
          );
          const trackPath = getTrackPath({ mediaType: params.type, media });
          if (trackPath) {
            trackUrl = await getBlobUrl(trackPath);
          }
          if (active) {
            setVideoSrc(videoUrl);
            setTrackSrc(trackUrl || "");
          }
        }
      } catch (err) {
        console.error('[Player] Error loading media:', err);
        dispatch({ type: HAS_ERROR, payload: "Error loading media" });
      }
    })();

    return () => {
      active = false;
      if (videoUrl && !media.isNextcloudShare) {
        // Only revoke blob URLs for local videos
        URL.revokeObjectURL(videoUrl);
      }
      if (trackUrl) URL.revokeObjectURL(trackUrl);
    };
  }, [media, params.type, dispatch]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !media || !videoSrc) return () => {};
    let active = true;

    const videoId = params.id;

    async function loadProgress() {
      try {
        const res = await fetch(`${SERVER_URL}/progress/${videoId}`, {
          credentials: "include",
        });
        if (!active) return;
        if (res.status === 404) return;
        if (!res.ok) throw new Error("Failed to load progress");
        const data = await res.json();
        const resumeTo = computeResumeTime(data, videoEl.duration);
        if (resumeTo !== null) {
          videoEl.currentTime = resumeTo;
        }
      } catch (err) {
        // non-blocking
      }
    }

    const onTimeUpdate = () => {
      const now = Math.floor(videoEl.currentTime || 0);
      if (now - lastSavedRef.current >= 5) {
        lastSavedRef.current = now;
        saveProgress(now, Math.floor(videoEl.duration || 0));
      }
    };

    const onPause = () => {
      const now = Math.floor(videoEl.currentTime || 0);
      saveProgress(now, Math.floor(videoEl.duration || 0));
    };

    const onEnded = () => {
      saveProgress(
        Math.floor(videoEl.currentTime || 0),
        Math.floor(videoEl.duration || 0)
      );
    };

    if (videoEl.readyState >= 1) {
      loadProgress();
    } else {
      const onLoadedMetadata = () => loadProgress();
      videoEl.addEventListener("loadedmetadata", onLoadedMetadata, {
        once: true,
      });
    }
    videoEl.addEventListener("timeupdate", onTimeUpdate);
    videoEl.addEventListener("pause", onPause);
    videoEl.addEventListener("ended", onEnded);

    return () => {
      active = false;
      videoEl.removeEventListener("timeupdate", onTimeUpdate);
      videoEl.removeEventListener("pause", onPause);
      videoEl.removeEventListener("ended", onEnded);
    };
  }, [media, videoSrc, params.id, SERVER_URL]);

  return !media || !videoSrc ? (
    <Loading></Loading>
  ) : (
    <div className="player">
      <button
        className="player-back"
        onClick={() => {
          const videoEl = videoRef.current;
          if (videoEl) {
            saveProgress(
              Math.floor(videoEl.currentTime || 0),
              Math.floor(videoEl.duration || 0)
            );
          }
          history.goBack();
        }}
      >
        Back
      </button>
      {
        <video
          ref={videoRef}
          className="video-guy"
          onError={onErrorHandle}
          preload="metadata"
          controls
          id="videoPlayer"
          crossOrigin="anonymous"
          autoPlay={true}
        >
          <source
            src={videoSrc}
            type="video/mp4"
          ></source>
          {trackSrc ? (
            <>
              <track
                src={trackSrc}
                label="English"
                kind="subtitles"
                srcLang="en"
                default
              ></track>
              <track
                src={trackSrc}
                label="Portuguese"
                kind="subtitles"
                srcLang="pt"
              ></track>
            </>
          ) : null}
        </video>
      }
    </div>
  );
}

export default Player;

Player.propTypes = {
  match: PropTypes.object,
  dispatch: PropTypes.func.isRequired,
};
