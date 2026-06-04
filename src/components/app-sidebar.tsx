import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, UserPlus, Upload, AlertTriangle, ShieldCheck, CreditCard, FileBarChart, Bell, Settings, Building2, LogOut, Activity, Lock, Image } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Add Student", url: "/students/new", icon: UserPlus },
  { title: "Upload Center", url: "/uploads", icon: Upload },
  { title: "Photo Upload", url: "/photos", icon: Image },
  { title: "Exceptions", url: "/exceptions", icon: AlertTriangle },
  { title: "KYC Monitoring", url: "/kyc", icon: ShieldCheck },
  { title: "Card Generation", url: "/cards", icon: CreditCard },
  { title: "Reports", url: "/reports", icon: FileBarChart },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Institutions", url: "/institutions", icon: Building2 },
  { title: "Security", url: "/settings/security", icon: Lock },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Audit Log", url: "/audit", icon: Activity },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { signOut, user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin((data ?? []).some((r) => ["admin", "super_admin"].includes(r.role as string)));
    });
  }, [user]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="h-8 w-8 rounded-lg bg-[image:var(--gradient-primary)] flex items-center justify-center text-primary-foreground">
            <CreditCard className="h-4 w-4" />
          </div>
          {!collapsed && <span className="font-semibold text-sm">Card Portal</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={path === item.url}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="truncate">{user?.email ?? "Sign out"}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}