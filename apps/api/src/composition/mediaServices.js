import * as fileUseCasesModule from "../domain/fileUseCases";
import * as streamingUseCasesModule from "../domain/streamingUseCases";

function resolveService({ moduleObj, createKey = "", defaultKey = "default" }) {
  if (createKey && typeof moduleObj[createKey] === "function") {
    return moduleObj[createKey]();
  }
  return moduleObj[defaultKey];
}

export function createMediaServices({
  fileModule = fileUseCasesModule,
  streamingModule = streamingUseCasesModule,
} = {}) {
  const fileService = resolveService({
    moduleObj: fileModule,
    createKey: "createFileUseCases",
  });
  const streamService = resolveService({
    moduleObj: streamingModule,
    createKey: "createStreamingUseCases",
  });

  return { fileService, streamService };
}

