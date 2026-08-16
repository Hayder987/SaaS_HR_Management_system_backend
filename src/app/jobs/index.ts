import cron from "node-cron";

import { processUnonboardedUsers } from "./processUnonboardedUsers";

export const startCronJobs = () => {
  /**
   * Run every 5 minutes.
   *
   * This allows the system to process users
   * shortly after their exact 48h / 72h deadline.
   */
  cron.schedule("*/5 * * * *", async () => {
    try {
      await processUnonboardedUsers();
    } catch (error) {
      console.error(
        "Unonboarded user processing failed:",
        error,
      );
    }
  });

  console.log("Cron jobs started");
};