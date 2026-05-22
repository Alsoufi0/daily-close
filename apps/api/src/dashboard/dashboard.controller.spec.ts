import { ForbiddenException } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { RequestUser } from "../auth/request-user";

const ownerOne: RequestUser = {
  id: "u1",
  name: "Owner One",
  email: "one@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-1"
};

const ownerTwo: RequestUser = {
  id: "u2",
  name: "Owner Two",
  email: "two@demo.com",
  role: "STORE_OWNER",
  ownerId: "owner-2"
};

const employee: RequestUser = {
  id: "u3",
  name: "Maya",
  email: "maya@demo.com",
  role: "EMPLOYEE",
  employeeId: "e-1",
  storeId: "store-1"
};

describe("DashboardController authz", () => {
  it("allows owner to read their own dashboard", () => {
    const service = { getOwnerToday: jest.fn().mockReturnValue([]) };
    const controller = new DashboardController(service as any);
    controller.getOwnerToday("owner-1", ownerOne);
    expect(service.getOwnerToday).toHaveBeenCalledWith("owner-1");
  });

  it("forbids one owner from reading another owner's dashboard", () => {
    const service = { getOwnerToday: jest.fn() };
    const controller = new DashboardController(service as any);
    expect(() => controller.getOwnerToday("owner-1", ownerTwo)).toThrow(ForbiddenException);
    expect(service.getOwnerToday).not.toHaveBeenCalled();
  });

  it("forbids an employee from reading any owner's dashboard", () => {
    const service = { getOwnerToday: jest.fn() };
    const controller = new DashboardController(service as any);
    expect(() => controller.getOwnerToday("owner-1", employee)).toThrow(ForbiddenException);
  });
});
