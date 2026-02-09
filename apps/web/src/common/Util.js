import config from "../config";
import { IMG_CHECK_STATUS } from "./constants";
const { SERVER_URL } = config();

export function requiredParameter(name, isThrow = true) {
  if (isThrow) {
    console.warn("requiredParameter, the code should be wrap in a try catch");
    throw new Error(`${name} is required`);
  } else {
    console.error(`${name} is required *`);
  }
}

export async function subscribeServerStatus({
  onHandleStatus,
  imgName = IMG_CHECK_STATUS,
}) {
  try {
    const res = await fetch(`${SERVER_URL}/health`, {
      credentials: "include",
    });
    onHandleStatus(res.ok);
  } catch (err) {
    onHandleStatus(false);
  }
}
