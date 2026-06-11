import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { SkipToContent } from "@/components/skip-to-content";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/sign-in?error=oauth");
  }

  const isAdmin = profile.role === "admin";

  return (
    <>
      <SkipToContent />
      <SiteHeader
        displayName={profile.display_name}
        email={user.email ?? ""}
        isAdmin={isAdmin}
      />
      <div id="main" className="flex-1 pb-20 md:pb-0">
        {children}
      </div>
      <MobileTabBar isAdmin={isAdmin} />
    </>
  );
}
