import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { DashboardShell } from "@/components/app/DashboardShell";
import { getMyCrmConfig } from "@/lib/crm-config.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  // CRM sozlanmagan foydalanuvchini onboarding wizard'ga yo'naltiramiz.
  loader: async () => {
    const config = await getMyCrmConfig();
    if (!config.hasConfig) throw redirect({ to: "/onboarding" });
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  return (
    <DashboardShell email={user?.email ?? undefined}>
      <Outlet />
    </DashboardShell>
  );
}
