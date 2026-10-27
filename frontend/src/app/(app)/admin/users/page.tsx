import { RequirePermission } from "@/components/require-permission";
import { UsersData } from "./users-data";

export default function AdminUsersPage() {
  return (
    <RequirePermission permission="users.view">
      <UsersData />
    </RequirePermission>
  );
}
