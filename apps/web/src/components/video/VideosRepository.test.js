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
});
