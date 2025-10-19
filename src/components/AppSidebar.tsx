import { NavLink, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Presentation,
  FolderOpen,
  Eye,
  Hammer,
  Megaphone,
  Calendar,
  Link2,
  BarChart3,
  Activity,
  TrendingUp,
  Map,
  Settings,
  Shield,
  MapPin,
  QrCode,
  FlaskConical,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar"

const navigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "Decks",
    items: [
      { title: "Deck Management", url: "/deck-management", icon: FolderOpen },
      { title: "Deck Builder", url: "/deck-builder", icon: Hammer },
      { title: "Deck Viewer", url: "/deck", icon: Eye },
      { title: "Deck Manager", url: "/deck-manager", icon: Link2 },
    ],
  },
  {
    title: "Campaigns",
    items: [
      { title: "Campaign Orchestration", url: "/campaign-config", icon: Megaphone },
    ],
  },
  {
    title: "Analytics",
    items: [
      { title: "Campaign Analytics", url: "/campaign-analytics", icon: BarChart3 },
      { title: "Campaign Dashboard", url: "/campaign-dashboard", icon: LayoutDashboard },
      { title: "Virality Dashboard", url: "/virality-dashboard", icon: TrendingUp },
      { title: "Activity Monitor", url: "/activity-monitor", icon: Activity },
    ],
  },
  {
    title: "Admin",
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Admin Panel", url: "/admin", icon: Shield },
      { title: "Zip Code Importer", url: "/zip-code-importer", icon: MapPin },
      { title: "QR Debug Tool", url: "/qr-debug", icon: QrCode },
      { title: "Simulator", url: "/simulator", icon: FlaskConical },
    ],
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Presentation className="h-6 w-6 text-primary" />
          {!isCollapsed && (
            <span className="font-semibold text-lg">Democracy Forge</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.url || 
                    (item.url === "/deck" && location.pathname.startsWith("/deck/"))
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <NavLink to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
