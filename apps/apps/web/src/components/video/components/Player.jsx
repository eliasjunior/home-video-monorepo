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
      } catch (err) {
        dispatch({ type: HAS_ERROR, payload: "Error loading media" });
      }
    })();

    return () => {
      active = false;
      if (videoUrl) URL.revokeObjectURL(videoUrl);
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
