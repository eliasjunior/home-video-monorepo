export async function getVideosList({ api, isSeries }) {
  const { get } = api;
  try {
    const response = isSeries ? await get("series") : await get("videos");
    switch (response.status) {
      case 500:
        return { mediaMap: { error: response } };
      default:
        return { mediaMap: response };
    }
  } catch (err) {
    console.error("getVideosList", err);
    throw err;
  }
}

export async function getVideo(obj) {
  const { api, resource } = obj;
  const { getById } = api;
  try {
    const response = await getById(resource, obj.id);
    if (response.status && response.status >= 400) {
      const isSeries = resource === "series";
      const listResponse = await getVideosList({ api, isSeries });
      const map = listResponse.mediaMap?.byId || {};
      const item = map[obj.id];
      if (!item) {
        throw new Error("Video not found");
      }
      const { name, id, sub, img, parentId } = item;
      return { name, id, sub, img, parentId };
    }
    const { name, id, sub, img, parentId } = response;
    return { name, id, sub, img, parentId };
  } catch (err) {
    console.error("getVideo", err);
    throw err;
  }
}
