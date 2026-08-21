import cron from "node-cron";

import { processUnonboardedUsers } from "./processUnonboardedUsers";

export const startCronJobs = () => {
  
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