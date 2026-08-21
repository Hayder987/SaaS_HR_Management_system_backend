import PDFDocument from "pdfkit";

export interface VoucherData {
  voucherNumber: string;

  customerName: string;
  customerEmail: string;

  planName: string;
  amount: string;
  currency: string;

  paymentDate: Date;

  periodStart?: Date;
  periodEnd?: Date;

  stripeInvoiceId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
}

export const generateSubscriptionVoucher = async (
  data: VoucherData,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 0,
      });

      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => {
        chunks.push(chunk);
      });

      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on("error", (error) => {
        reject(error);
      });

      // =====================================================
      // COLORS
      // =====================================================

      const ORANGE = "#F97316";
      const DARK = "#111827";
      const GRAY = "#6B7280";
      const LIGHT_GRAY = "#F3F4F6";
      const BORDER = "#E5E7EB";
      const WHITE = "#FFFFFF";
      const GREEN = "#16A34A";

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      const left = 50;
      const right = pageWidth - 50;
      const contentWidth = right - left;

      // =====================================================
      // HEADER
      // =====================================================

      doc.rect(0, 0, pageWidth, 125).fill(DARK);

      // Orange accent
      doc.rect(0, 0, 8, 125).fill(ORANGE);

      // Brand
      doc
        .font("Helvetica-Bold")
        .fontSize(23)
        .fillColor(WHITE)
        .text("HR", left, 32, {
          continued: true,
        })
        .fillColor(ORANGE)
        .text(" Management");

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#D1D5DB")
        .text("Human Resource Management Platform", left, 62);

      // Voucher title
      doc
        .font("Helvetica-Bold")
        .fontSize(19)
        .fillColor(WHITE)
        .text("PAYMENT VOUCHER", left, 85);

      // =====================================================
      // PAID BADGE
      // =====================================================

      doc.roundedRect(right - 90, 38, 90, 32, 16).fill(GREEN);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(WHITE)
        .text("✓  PAID", right - 90, 48, {
          width: 90,
          align: "center",
        });

      // =====================================================
      // VOUCHER META
      // =====================================================

      let y = 155;

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(GRAY)
        .text("VOUCHER NUMBER", left, y);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(DARK)
        .text(data.voucherNumber, left, y + 15);

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(GRAY)
        .text("PAYMENT DATE", right - 150, y);

      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor(DARK)
        .text(
          data.paymentDate.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
          right - 150,
          y + 15,
          {
            width: 150,
            align: "right",
          },
        );

      y += 60;

      // =====================================================
      // CUSTOMER INFORMATION CARD
      // =====================================================

      doc.roundedRect(left, y, contentWidth, 85, 8).fill(LIGHT_GRAY);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(DARK)
        .text("CUSTOMER", left + 18, y + 15);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(DARK)
        .text(data.customerName, left + 18, y + 37);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY)
        .text(data.customerEmail, left + 18, y + 56);

      y += 115;

      // =====================================================
      // PAYMENT SUMMARY TITLE
      // =====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(DARK)
        .text("Payment Summary", left, y);

      y += 25;

      // =====================================================
      // PAYMENT SUMMARY BOX
      // =====================================================

      const summaryHeight = 155;

      doc
        .roundedRect(left, y, contentWidth, summaryHeight, 8)
        .lineWidth(1)
        .strokeColor(BORDER)
        .stroke();

      // Plan
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY)
        .text("SUBSCRIPTION PLAN", left + 18, y + 18);

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(DARK)
        .text(data.planName, left + 18, y + 35);

      // Amount
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY)
        .text("AMOUNT PAID", right - 180, y + 18);

      doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .fillColor(ORANGE)
        .text(
          `${data.amount} ${data.currency.toUpperCase()}`,
          right - 180,
          y + 34,
          {
            width: 160,
            align: "right",
          },
        );

      // Divider
      doc
        .moveTo(left + 18, y + 70)
        .lineTo(right - 18, y + 70)
        .lineWidth(1)
        .strokeColor(BORDER)
        .stroke();

      // Billing period
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY)
        .text("BILLING PERIOD", left + 18, y + 88);

      const billingPeriod =
        data.periodStart && data.periodEnd
          ? `${data.periodStart.toLocaleDateString("en-US")}  —  ${data.periodEnd.toLocaleDateString("en-US")}`
          : "N/A";

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(DARK)
        .text(billingPeriod, left + 18, y + 107);

      // Payment status
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(GRAY)
        .text("PAYMENT STATUS", right - 180, y + 88);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(GREEN)
        .text("PAID / SUCCESSFUL", right - 180, y + 107, {
          width: 160,
          align: "right",
        });

      y += summaryHeight + 35;

      // =====================================================
      // TRANSACTION INFORMATION
      // =====================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .fillColor(DARK)
        .text("Transaction Information", left, y);

      y += 25;

      const transactionStartY = y;

      const drawTransactionRow = (label: string, value: string | undefined) => {
        if (!value) return;

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(GRAY)
          .text(label.toUpperCase(), left + 15, y);

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(DARK)
          .text(value, left + 160, y, {
            width: contentWidth - 175,
          });

        y += 23;
      };

      doc
        .roundedRect(left, transactionStartY, contentWidth, 105, 8)
        .fill("#FAFAFA");

      drawTransactionRow("Stripe Invoice ID", data.stripeInvoiceId);

      drawTransactionRow("Stripe Subscription ID", data.stripeSubscriptionId);

      drawTransactionRow("Payment Intent ID", data.stripePaymentIntentId);

      // =====================================================
      // SUCCESS MESSAGE
      // =====================================================

      y += 20;

      doc.roundedRect(left, y, contentWidth, 58, 8).fill("#F0FDF4");

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(GREEN)
        .text("Payment completed successfully", left + 18, y + 13);

      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor("#166534")
        .text(
          "Your subscription has been activated successfully.",
          left + 18,
          y + 32,
        );

      // =====================================================
      // FOOTER
      // =====================================================

      const footerY = pageHeight - 75;

      doc
        .moveTo(left, footerY)
        .lineTo(right, footerY)
        .lineWidth(1)
        .strokeColor(BORDER)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(DARK)
        .text("HR Management", left, footerY + 18);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRAY)
        .text(
          "This voucher was automatically generated by HR Management.",
          left,
          footerY + 33,
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRAY)
        .text(
          `Generated: ${new Date().toLocaleString("en-US")}`,
          right - 180,
          footerY + 18,
          {
            width: 180,
            align: "right",
          },
        );

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(GRAY)
        .text(
          "Thank you for choosing HR Management.",
          right - 180,
          footerY + 33,
          {
            width: 180,
            align: "right",
          },
        );

      // =====================================================
      // FINISH PDF
      // =====================================================

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
