import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { ProfileSettingsForm } from "@/components/settings/profile-settings-form";
import { findUserForSettingsPage } from "@/lib/users/settings-user-query";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login?next=/settings");

  const user = await findUserForSettingsPage(me.id);
  if (!user) redirect("/login?next=/settings");

  return (
    <ProfileSettingsForm
      user={{
        ...user,
        createdAt: user.createdAt.toISOString(),
        usernameChangedAt: user.usernameChangedAt?.toISOString() ?? null,
      }}
    />
  );
}
