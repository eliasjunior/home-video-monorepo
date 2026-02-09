import { mapMedia } from "./MediaMapper";
import path from 'path';
import { getImageUrl } from "../../common/Util";

jest.mock("../../common/Util", () => ({
  getImageUrl: jest.fn(),
}));


describe("MediaMapper", () => {
  it("should map a media", () => {
    getImageUrl.mockReturnValueOnce("");
    const fileList = ["myMovie.mp4", "myMovie.srt"];

    const fileExtEqual = (fileName) => {
      return path.extname(fileName).toLowerCase();
    };
    const objMedia = mapMedia({
      files: fileList,
      folderName: "some",
      fileExtEqual,
    });
    const expected = {
      name: "myMovie.mp4",
      sub: "myMovie.srt",
      description: "",
      id: "some",
      img: "movie_fallback.png",
    };
    expect(objMedia.name).toEqual(expected.name);
    expect(objMedia.sub).toEqual(expected.sub);
    expect(objMedia.id).toEqual(expected.id);
    expect(objMedia.img).toContain(expected.img);
  });

  it("should get the images from image server", () => {
    getImageUrl.mockReturnValueOnce("http://image.server/harry.png");
    const objMedia = mapMedia({
      files: ["myMovie.mp4", "myMovie.srt"],
      folderName: "Harry Potter and the Deathly Hallows Part 1 (2010) [1080p]",
      fileExtEqual: () => {},
    });
    //"harrypotterandthedeathlyhallowspart120101080p"
    expect(objMedia.img).toContain("harry");
  });
});
