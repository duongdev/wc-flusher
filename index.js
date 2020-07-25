const Ewelink = require("ewelink-api");
const fs = require("fs");
const path = require("path");

require("log-timestamp");

const { EMAIL, PASSWORD, REGION, DEVICE_ID, FLUSH_TIMEOUT } = process.env;

let timeout = setTimeout(() => {}, 0);
let socket;

const ewelink = new Ewelink({
  email: EMAIL,
  password: PASSWORD,
  region: REGION,
});

const turnOffDevice = async () => {
  try {
    await ewelink.setDevicePowerState(DEVICE_ID, "off");
    resolve(true);
  } catch (error) {
    console.log(`Couldn't turn off the device. Retrying (2/3)...`);
    try {
      await ewelink.setDevicePowerState(DEVICE_ID, "off");
      resolve(true);
    } catch (error) {
      console.log(`Couldn't turn off the device. Retrying (3/3)...`);
      try {
        await ewelink.setDevicePowerState(DEVICE_ID, "off");
        resolve(true);
      } catch (error) {
        console.log(`Couldn't turn off the device. Exiting...`);
        process.exit();
      }
    }
  }
  fs.writeFileSync(path.resolve(__dirname, "last-turned-on.txt"), "0");
};

const handleSwitchOn = async () => {
  let lastTurnedOn = 0;

  try {
    lastTurnedOn = +fs.readFileSync(
      path.resolve(__dirname, "last-turned-on.txt"),
      { encoding: "utf-8" }
    );
  } catch (e) {}

  fs.writeFileSync(
    path.resolve(__dirname, "last-turned-on.txt"),
    Date.now().toString()
  );

  const TIMEOUT = Math.min(+FLUSH_TIMEOUT * 1000, Date.now() - lastTurnedOn);

  return new Promise((resolve, reject) => {
    clearTimeout(timeout);

    console.log(`Current status: on`);
    console.log(`Auto turn off in ${Math.round(TIMEOUT / 1000)} seconds.`);

    timeout = setTimeout(async () => {
      console.log("Auto turned off");
      await turnOffDevice();
    }, TIMEOUT);
  });
};

const getStatus = async (disableLog) => {
  const status = (await ewelink.getDevicePowerState(DEVICE_ID)).state;
  if (!disableLog) console.log(`Current status: ${status}`);
  return status;
};

setInterval(() => socket && socket.isOpened && socket.send("ping"), 5000);

const socketHeartbeat = async () => {
  const socketOpening = !!(socket && socket.isOpened);

  if (!socketOpening) {
    console.log(`Socket status: closed`);
    // await initSocket();
    console.log("Exiting...");
    process.exit();
  }
};

// setInterval(async () => {
//   // const status = await getStatus(true);
//   // if (status === "on") {
//   //   handleSwitchOn();
//   // }
//   await socketHeartbeat();
// }, +HEARTBEAT * 1000);

const initSocket = async () => {
  console.log("Initializing socket...");
  socket = await ewelink.openWebSocket(async (data) => {
    // data is the message from eWeLink
    // console.log(data);
    if (data.params && data.params.switch === "on") {
      handleSwitchOn();
    }

    if (data.params && data.params.switch === "off") {
      console.log(`Current status: off`);
      clearTimeout(timeout);
    }
  });

  console.log("Socket initialized.");

  socket.onClose.addListener(async () => {
    console.log("Socket is closed");
    console.log("Exiting...");
    process.exit();
  });
  return socket;
};

const main = async () => {
  try {
    const status = await getStatus();

    if (status === "on") {
      // console.log("Turning off...");
      // await ewelink.setDevicePowerState(DEVICE_ID, "off");
      handleSwitchOn();
    }

    await initSocket();
    await socketHeartbeat();
  } catch (e) {
    console.log("Error occurred");
    console.log(e);
    process.exit(0);
  }
};

main();

process.on("SIGINT", () => {
  console.log(" - Caught SIGINT. Exiting in 3 seconds.");
  console.log("Closing WebSocket...");
  var cls = socket && socket.close();
  setTimeout(() => {
    process.exit(0);
  }, 3000);
});
