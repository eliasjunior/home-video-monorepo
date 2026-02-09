import { getVideosList, getVideo } from "./VideosRepository";
describe("VideosService", () => {
  it("should return {} when response is corrupted", async () => {
    const get = () => Promise.resolve({});
    const response = await getVideosList({ api: { get } });
    expect(response).toEqual({ mediaMap: {} });
  });

  it("should return correct when response is []", async () => {
    const get = () => Promise.resolve([]);
    const response = await getVideosList({ api: { get } });
    expect(response).toEqual({ mediaMap: [] });
  });

  it("should get video by id ", async () => {
    const getById = () =>
      Promise.resolve({
        name: "test-name",
        id: "test-id",
        sub: "some-sub.srt",
        img: "some-img.jpg",
      });
    const id = "video-folder";
    const response = await getVideo({ api: { getById }, id });

    expect(response).toEqual({
      name: "test-name",
      id: "test-id",
      sub: "some-sub.srt",
      img: "some-img.jpg",
    });
  });

  it("getVideosList returns error map on status 500", async () => {
    const get = () => Promise.resolve({ status: 500, message: "boom" });
    const response = await getVideosList({ api: { get } });
    expect(response).toEqual({ mediaMap: { error: { status: 500, message: "boom" } } });
  });

  it("getVideo falls back to list when detail fails", async () => {
    const getById = () => Promise.resolve({ status: 404 });
    const get = () =>
      Promise.resolve({
        byId: { v1: { name: "v1", id: "v1", sub: "s.srt", img: "i.jpg" } },
        allIds: ["v1"],
      });
    const response = await getVideo({ api: { getById, get }, id: "v1", resource: "videos" });
    expect(response).toEqual({
      name: "v1",
      id: "v1",
      sub: "s.srt",
      img: "i.jpg",
      parentId: undefined,
    });
  });

  it("getVideo throws when fallback list is missing item", async () => {
    const getById = () => Promise.resolve({ status: 404 });
    const get = () => Promise.resolve({ byId: {}, allIds: [] });
    await expect(
      getVideo({ api: { getById, get }, id: "missing", resource: "videos" })
    ).rejects.toThrow("Video not found");
  });
});
