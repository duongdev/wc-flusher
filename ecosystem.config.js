module.exports = {
  apps: [
    {
      name: "wc-flusher",
      script: "npm -- start",
      watch: true,
      ignore_watch: ["last-turned-on.txt"],
    },
  ],
};
