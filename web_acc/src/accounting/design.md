layout:
  ┌─────────────────────────────┐   ┌─────────────────────────────────┐
  │  BANK TRANSACTIONS (list)   │   │  RECONCILE (detail of selected) │
  │                             │   │                                 │
  │ ▎🧾 ACME INVOICE PAY  +9000 │◄──┤  → shows INVOICES to link       │
  │ ▎🛒 RENT AUGUST      -3200  │   │                                 │
  │ ▎🔄 MOVE TO SAVINGS  -3000  │   │                                 │
  │ ▎🏦 OPENING DEPOSIT +25000  │   │                                 │
  └─────────────────────────────┘   └─────────────────────────────────┘



LEft side:
 Each transaction becomes a card-like row with three visual zones read left→right:

  ┌──────────────────────────────────────────────────────────────────────┐
  │ ▎🧾  ACME CORP INVOICE PAYMENT          ↑ 9,000.00      ● Link invoice →│
  │ ▎    Aug 3 · invoice                     bal 34,000                     │
  ├──────────────────────────────────────────────────────────────────────┤
  │ ▎🛒  RENT — AUGUST                       ↓ 3,200.00      ● Attach receipt→│
  │ ▎    Aug 5 · expense                     bal 30,800                     │
  ├──────────────────────────────────────────────────────────────────────┤
  │ ▎🔄  MOVE TO SAVINGS                     ↓ 3,000.00      no match needed │
  │ ▎    Aug 6 · transfer                    bal 27,800                     │
  ├──────────────────────────────────────────────────────────────────────┤
  │ ▎🏦  OPENING DEPOSIT                      ↑ 25,000.00     starting balance│
  │ ▎    Aug 1 · opening                     bal 25,000                     │
  └──────────────────────────────────────────────────────────────────────┘