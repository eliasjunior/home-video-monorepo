const fs = require("fs");
const os = require("os");

function getLocalIPAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Look for the IPv4, non-internal address
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1"; // Fallback to localhost
}

const ipAddress = getLocalIPAddress();
const envFilePath = ".env";
let envFileContent = fs.readFileSync(envFilePath, "utf8");

const newEnvFileContent = envFileContent.replace(
  /^REACT_APP_SERVER_HOST=.*$/m,
  `REACT_APP_SERVER_HOST=${ipAddress}`
);

if (!/^REACT_APP_SERVER_HOST=.*$/m.test(envFileContent)) {
  fs.appendFileSync(envFilePath, `\nREACT_APP_SERVER_HOST=${ipAddress}`);
} else {
  fs.writeFileSync(envFilePath, newEnvFileContent);
}

console.log(`Local IP address set in .env: ${ipAddress}`);
