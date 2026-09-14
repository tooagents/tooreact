import { InvDB, BE_DB, ItemDB } from "./dto";
import { date2string } from "./dateUtils";

// Template t4: Dark Mode
export const t18 = (
    oInv: Partial<InvDB>,
    oBiz: Partial<BE_DB>,
    previewMode: "pdf" | "picker" | "view" = "pdf",
) => {

    const paidStamp = (oInv.inv_payment_status === "Paid" || (Number(oInv.inv_balance_due) === 0) && (Number(oInv.inv_total) !== 0)) && oBiz.be_show_paid_stamp
        ? `
            <div class="paid-stamp">PAID</div>
        `
        : "";


    const bodyContent = `
    <div class="container">
    <img src="https://aiautoinvoicing.github.io/img/svg/logo.svg" alt="Logo" class="logo" style="width: 250px; height: 120px; " />

    <h1>Want a Premium Custom Invoice?</h1>
    <p>Send us a photo of your current invoice design at:</p>
    <p class="email">AIAutoInvoicing@gmail.com</p>
    <p>We’ll craft a ready-to-use template that matches your style.</p>
    <a href="https://your-payment-link.com" class="button">
    Get My Template<br>Only US$19 (+ taxes)
  </a>
  </div>`;

    return `<!DOCTYPE html><html>
  <head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Custom Invoice Template</title>
  <style>
    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #fff;
        color: #333;
        margin: 0;
        padding: 0;
    }

    .container {
        padding: 12px;
        border-radius: 10px;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        text-align: center;
    }

    .logo {
      width: 160px;
    }

    h1 {
      color: #F28500;
      font-size: 3.0em;
    }

    p {
      font-size: 2.2em;
      margin: 20px 0;
      line-height: 1.5;
    }

    .email {
      font-weight: bold;
      color: #000;
    }

    .price {
      font-size: 2.6em;
      color: #F28500;
      margin-top: 20px;
    }

.button {
  display: inline-block;
  margin-top: 18px;
  padding: 14px 28px;
  background-color: #F28500;
  color: white;
  text-decoration: none;
  border-radius: 10px;
  font-weight: bold;
  font-size: 2.85rem;
}

    .button:hover {
      background-color: #d67400;
    }
  </style>
</head>
  <body>
    ${previewMode === "pdf"
            ? `<div style="transform: scale(1); transform-origin: top left; width: 100%;">${bodyContent}</div>`
            : previewMode === "view"
                ? `<div style="transform: scale(0.5); transform-origin: top left; width: 200%;">${bodyContent}</div>`
                : `<div style="transform: scale(0.29); transform-origin: top left; width: 350%;">${bodyContent}</div>`
        }
  </body>
</html>`;
};


