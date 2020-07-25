const Ewelink = require("ewelink-api");

require("log-timestamp");

const { EMAIL, PASSWORD, REGION, DEVICE_ID, FLUSH_TIMEOUT } = process.env;

let timeout = setTimeout(() => {}, 0);

const ewelink = new Ewelink({
  email: EMAIL,
  password: PASSWORD,
  region: REGION,
});

const handleSwitchOn = async () => {
  return new Promise((resolve, reject) => {
    clearTimeout(timeout);

    console.log(`Current status: on`);
    console.log(`Auto turn off in ${FLUSH_TIMEOUT} second(s).`);

    timeout = setTimeout(async () => {
      console.log("Auto turned off");
      try {
        await ewelink.setDevicePowerState(DEVICE_ID, "off");
        resolve(true);
      } catch (error) {
        console.log(`Couldn't turn off the device`);
        reject(error);
      }
    }, +FLUSH_TIMEOUT * 1000);
  });
};

const getStatus = async (disableLog) => {
  const status = (await ewelink.getDevicePowerState(DEVICE_ID)).state;
  if (!disableLog) console.log(`Current status: ${status}`);
  return status;
};

// setInterval(async () => {
//   const status = await getStatus(true);
//   if (status === "on") {
//     handleSwitchOn();
//   }
// }, +FLUSH_TIMEOUT * 2 * 1000);

const main = async () => {
  try {
    const status = await getStatus();

    if (status === "on") {
      await ewelink.setDevicePowerState(DEVICE_ID, "off");
    }

    const socket = await ewelink.openWebSocket(async (data) => {
      // data is the message from eWeLink
      // console.log(data);
      if (data.params && data.params.switch === "on") {
        await handleSwitchOn();
      }

      if (data.params && data.params.switch === "off") {
        console.log(`Current status: off`);
        clearTimeout(timeout);
      }
    });

    setInterval(async () => {
      await socket.send("ping");
    }, 60e3);
  } catch (e) {
    console.log("Error occurred");
    console.log(e);
    process.exit(0);
  }
};

main();
