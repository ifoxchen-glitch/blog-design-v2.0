const cron = require("node-cron");
const { snapshotCards } = require("../apps/admin/iot/cardHandlers");

function register() {
  // Every hour at :00 — snapshot current card usage for trend analysis
  cron.schedule("0 * * * *", () => {
    try {
      console.log("[cron] iotHourlySync: starting snapshot...");
      const count = snapshotCards();
      console.log(`[cron] iotHourlySync: done — snapshotted ${count} cards`);
    } catch (err) {
      console.error("[cron] iotHourlySync failed:", err.message);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai",
  });
  console.log("[cron] iotHourlySync job registered (0 * * * *)");
}

module.exports = { register };
