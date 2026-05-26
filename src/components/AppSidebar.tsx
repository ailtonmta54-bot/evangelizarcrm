import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Bot,
  Zap,
  Package,
  Users,
  Settings,
  Cross,
  ShieldCheck,
  Briefcase,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/use-user-role";
import { Badge } from "@/components/ui/badge";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, adminOnly: false },
  { title: "Inbox", url: "/inbox", icon: MessageSquare, adminOnly: false },
  { title: "CRM", url: "/crm", icon: Kanban, adminOnly: false },
  { title: "Contatos", url: "/contatos", icon: Users, adminOnly: false },
  { title: "Robôs IA", url: "/robos", icon: Bot, adminOnly: true },
  { title: "Automações", url: "/automacoes", icon: Zap, adminOnly: true },
  { title: "Produtos", url: "/produtos", icon: Package, adminOnly: false },
  { title: "Configurações", url: "/settings", icon: Settings, adminOnly: false },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { isAdmin } = useUserRole();

  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-4 py-5">
          <Cross className="h-7 w-7 text-sidebar-primary shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
              Evangelizar CRM
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mt-auto px-4 pb-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{isAdmin ? "Admin" : "Usuário"}</span>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
