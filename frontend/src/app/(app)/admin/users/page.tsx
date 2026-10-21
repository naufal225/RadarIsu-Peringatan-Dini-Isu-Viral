import { RequirePermission } from "@/components/require-permission";
import { UsersPanel } from "./users-panel";

export default function AdminUsersPage() {
  return (
    <RequirePermission permission="users.view">
      <UsersPanel />
    </RequirePermission>
  );
}
