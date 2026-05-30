import { EmployeeClose } from "../../components/employee-close";
import { RequireAuth } from "../../components/require-auth";

export default function EmployeePage() {
  return (
    <RequireAuth allowedRoles={["EMPLOYEE", "STORE_OWNER", "SUPER_ADMIN"]}>
      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <EmployeeClose />
      </main>
    </RequireAuth>
  );
}
