import { OwnerDashboard } from "../../components/owner-dashboard";
import { RequireAuth } from "../../components/require-auth";

export default function OwnerPage() {
  return (
    <RequireAuth allowedRoles={["STORE_OWNER", "SUPER_ADMIN"]} allowManagers>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <OwnerDashboard />
      </main>
    </RequireAuth>
  );
}
