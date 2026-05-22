import { Injectable } from "@nestjs/common";
import { RequestUser } from "../auth/request-user";
import { DashboardService } from "../dashboard/dashboard.service";

@Injectable()
export class ReportsService {
  constructor(private readonly dashboard: DashboardService) {}

  buildCsv(rows: Record<string, string | number>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((header) => row[header]).join(","));
    return [headers.join(","), ...body].join("\n");
  }

  async buildTodayCsv(user: RequestUser): Promise<string> {
    const summary = await this.dashboard.getMyToday(user);
    return this.buildCsv(
      summary.stores.map((store) => ({
        Store: store.storeName,
        Closed: store.closedToday ? "Yes" : "No",
        Sales: store.totalSales,
        Cash: store.cashSales,
        Card: store.cardSales,
        Difference: store.difference
      }))
    );
  }
}
