import type { ParsedPOSReport, StoreSummary } from "@smokeshop/shared/types";

export const demoOwner = {
  id: "owner-1",
  name: "Sam Owner",
  email: "owner@demo.com"
};

export const demoEmployees = [
  { id: "employee-1", name: "Maya", storeId: "store-a" },
  { id: "employee-2", name: "Chris", storeId: "store-b" }
];

export const stores: StoreSummary[] = [
  {
    id: "store-a",
    storeName: "Store #1",
    closedToday: true,
    totalSales: 4500,
    cashSales: 1800,
    cardSales: 2700,
    difference: 5,
    timezone: "America/New_York",
    closeTime: "23:30"
  },
  {
    id: "store-b",
    storeName: "Store #2",
    closedToday: false,
    totalSales: 0,
    cashSales: 0,
    cardSales: 0,
    difference: 0,
    timezone: "America/New_York",
    closeTime: "22:00",
    pastCloseTime: true
  },
  {
    id: "store-c",
    storeName: "Store #3",
    closedToday: true,
    totalSales: 3900,
    cashSales: 1500,
    cardSales: 2400,
    difference: -40,
    timezone: "America/Chicago",
    closeTime: "23:30"
  }
];

export const dailyCloses = [
  {
    id: "close-1",
    storeId: "store-a",
    employeeId: "employee-1",
    date: "2026-05-22",
    cashSales: 1800,
    cardSales: 2700,
    totalSales: 4500,
    countedCash: 1805,
    difference: 5
  },
  {
    id: "close-2",
    storeId: "store-c",
    employeeId: "employee-2",
    date: "2026-05-22",
    cashSales: 1500,
    cardSales: 2400,
    totalSales: 3900,
    countedCash: 1460,
    difference: -40
  },
  {
    id: "close-3",
    storeId: "store-a",
    employeeId: "employee-1",
    date: "2026-05-21",
    cashSales: 1710,
    cardSales: 2515,
    totalSales: 4225,
    countedCash: 1710,
    difference: 0
  }
];

export const missedCloseAlert = {
  storeId: "store-b",
  message: "Store #2 has not completed closing yet."
};

export const scannedReport: ParsedPOSReport = {
  parserType: "CLOVER",
  cashSales: 2430,
  cardSales: 3120,
  totalSales: 5550,
  tax: 412,
  refunds: 0,
  discounts: 35,
  confidence: 0.97
};
