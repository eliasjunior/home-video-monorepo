const { BASE_STREAM_CALC, EXPONENT } = require("../../common/AppServerConstant");
const { getStartEndBytes, getHeaderStream } = require("./StreamingUtilUseCase");

describe('VideoStreamingService', () => {
    it("should get start, end position from head range 0", () => {
      let initialRange = "bytes=0-";
      let size = 200;
      expect(getStartEndBytes(initialRange, size)).toEqual({
        end: 199,
        start: 0,
      });

      initialRange = "bytes=-";
      size = 200;
      expect(getStartEndBytes(initialRange, size)).toEqual({
        end: 199,
        start: 0,
      });

      initialRange = "bytes";
      size = 200;
      expect(getStartEndBytes(initialRange, size)).toEqual({
        end: 199,
        start: 0,
      });

      initialRange = "";
      size = 200;
      expect(getStartEndBytes(initialRange, size)).toEqual({
        end: 199,
        start: 0,
      });

      initialRange = "bytes=390-";
      size = 400;
      expect(getStartEndBytes(initialRange, size)).toEqual({
        end: 399,
        start: 390,
      });
    });
    it("should get start + (~= 5MB) that its the end", () => {
      let range = "bytes=1505329152-";
      let size = 2505329152;
      expect(getStartEndBytes(range, size)).toEqual({
        end: 1505329152 + Math.pow(BASE_STREAM_CALC, EXPONENT),
        start: 1505329152,
      });
    });

    it("should get the correct header from the stream ", () => {
      const start = 5000;
      const end = 5000 + Math.pow(BASE_STREAM_CALC, EXPONENT);
      const tenMBInDecimal = 10000000;
      const result = getHeaderStream({ start, end, size: tenMBInDecimal });

      expect(result["Content-Length"]).toEqual(end - start + 1);
      expect(result["Content-Range"]).toEqual(        
        `bytes ${start}-${end}/${tenMBInDecimal}`
      );
    });
});