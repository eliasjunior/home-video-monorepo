import { useState, useEffect } from "react";
import { subscribeServerStatus } from "common/Util";
import { IMG_CHECK_STATUS } from "common/constants";

export function useServerStatus(imgName = IMG_CHECK_STATUS) {
  const [isOnline, setIsOnline] = useState(false);

  const handleServerStatus = (value) => {
    setIsOnline(value);
  };

  useEffect(() => {
    subscribeServerStatus({ onHandleStatus: handleServerStatus, imgName });
  }, []);

  return isOnline;
}
