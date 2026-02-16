import { config } from "./src/common/AppServerConstant";
import { createApp } from "./src/composition/app";
import { startServer } from "./src/composition/startup";

const app = createApp({ appConfig: config, env: process.env });

startServer({ app, appConfig: config, env: process.env });

export default app;
