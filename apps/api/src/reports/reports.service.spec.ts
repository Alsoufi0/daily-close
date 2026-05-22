import { ReportsService } from "./reports.service";
import { RequestUser } from "../auth/request-user";

const owner: RequestUser = {
  id: "user-owner",
  name: "Owner",
  email: "owner@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

describe("ReportsService", () => {
  it("returns empty string when no rows are provided", () => {
    const service = new ReportsService({} as any);
    expect(service.buildCsv([])).toBe("");
  });

  it("emits header row then one row per record using the first row's keys", () => {
    const service = new ReportsService({} as any);
    const csv = service.buildCsv([
      { Store: "A", Sales: 100 },
      { Store: "B", Sales: 200 }
    ]);
    expect(csv).toBe("Store,Sales\nA,100\nB,200");
  });

  it("builds today's CSV with the expected columns from dashboard data", async () => {
    const dashboard = {
      getMyToday: jest.fn().mockResolvedValue({
        stores: [
          { storeName: "Store #1", closedToday: true, totalSales: 4500, cashSales: 1800, cardSales: 2700, difference: 5 },
          { storeName: "Store #2", closedToday: false, totalSales: 0, cashSales: 0, cardSales: 0, difference: 0 }
        ]
      })
    };
    const service = new ReportsService(dashboard as any);
    const csv = await service.buildTodayCsv(owner);
    const [header, row1, row2] = csv.split("\n");
    expect(header).toBe("Store,Closed,Sales,Cash,Card,Difference");
    expect(row1).toBe("Store #1,Yes,4500,1800,2700,5");
    expect(row2).toBe("Store #2,No,0,0,0,0");
    expect(dashboard.getMyToday).toHaveBeenCalledWith(owner);
  });
});
