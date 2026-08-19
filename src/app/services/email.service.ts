import path from "path";
import ejs from "ejs";
import { generateSubscriptionVoucher, VoucherData } from "./voucher.service";
import { transporter } from "../lib/nodemailer";
import config from "../config";

export const sendSubscriptionSuccessEmail = async (
  voucherData: VoucherData,
): Promise<void> => {
  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/subscription-success.ejs",
  );

  const templateData = {
    name: voucherData.customerName,

    planName: voucherData.planName,

    amount: voucherData.amount,

    currency: voucherData.currency.toUpperCase(),

    voucherNumber: voucherData.voucherNumber,
  };

  const html = await ejs.renderFile(templatePath, templateData);

  // Generate PDF in memory
  const voucherPdf = await generateSubscriptionVoucher(voucherData);

  await transporter.sendMail({
    from: config.email_sender,

    to: voucherData.customerEmail,

    subject: "Subscription Payment Successful",

    html,

    attachments: [
      {
        filename: `${voucherData.voucherNumber}.pdf`,

        content: voucherPdf,

        contentType: "application/pdf",
      },
    ],
  });
};
