import cron from "node-cron";

import { cleanupUnonboardedUsers } from "./cleanupUnonboardedUsers";

export const startCronJobs = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    try {
      await cleanupUnonboardedUsers();
    } catch (error) {
      console.error("Unonboarded user cleanup failed:", error);
    }
  });

  console.log("Cron jobs started");
};
