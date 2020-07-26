const Ewelink = require("ewelink-api");
const express = require("express");
const { getDb, setDb } = require("./db");

require("log-timestamp");

const { EMAIL, PASSWORD, REGION, DEVICE_ID, FLUSH_TIMEOUT } = process.env;

const app = express();
const port = 3000;

let timeout = setTimeout(() => {}, 0);
let socket;

const ewelink = new Ewelink({
  email: EMAIL,
  password: PASSWORD,
  region: REGION,
});

const setDevicePower = async (on) => {
  const status = on ? "on" : "off";

  try {
    await ewelink.setDevicePowerState(DEVICE_ID, status);
    // return true;
  } catch (error) {
    console.log(`Couldn't turn ${status} the device. Retrying (2/3)...`);
    try {
      await ewelink.setDevicePowerState(DEVICE_ID, status);
      // return true;
    } catch (error) {
      console.log(`Couldn't turn ${status} the device. Retrying (3/3)...`);
      try {
        await ewelink.setDevicePowerState(DEVICE_ID, status);
        // return true;
      } catch (error) {
        console.log(error);
        console.log(`Couldn't turn ${status} the device. Exiting...`);
        process.exit();
      }
    }
  }

  await setDb({ lastTurnedOn: 0 });
};

const handleSwitchOn = async () => {
  const lastTurnedOn = (await getDb("lastTurnedOn")) || 0;

  await setDb({ lastTurnedOn: Date.now() });

  const TIMEOUT = Math.min(+FLUSH_TIMEOUT * 1000, Date.now() - lastTurnedOn);

  return new Promise((resolve, reject) => {
    clearTimeout(timeout);

    console.log(`Current status: on`);
    console.log(`Auto turn off in ${Math.round(TIMEOUT / 1000)} seconds.`);

    timeout = setTimeout(async () => {
      console.log("Auto turned off");
      await setDevicePower();
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
    } else if (status === "off") {
      await setDb({ lastTurnedOn: 0 });
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

app.get("/toggle", async (req, res) => {
  const status = await getStatus();

  setDevicePower(status === "off");

  return res.json({ status: status === "on" ? "off" : "on" });
});

app.listen(port, () => {
  console.log(`Server is running on ${port}`);
});

process.on("SIGINT", () => {
  console.log(" - Caught SIGINT. Exiting in 3 seconds.");
  console.log("Closing WebSocket...");
  var cls = socket && socket.close();
  setTimeout(() => {
    process.exit(0);
  }, 3000);
});
