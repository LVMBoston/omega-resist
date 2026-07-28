import { useEffect, useState, type MouseEvent } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { LayoutDashboard } from "lucide-react"
import {
  Presentation,
  FolderOpen,
  Megaphone,
  Calendar,
  BarChart3,
  Activity,
  TrendingUp,
  Settings,
  Shield,
  MapPin,
  QrCode,
  FlaskConical,
  RotateCcw,
  Globe,
  Map,
  TestTube,
  HeartPulse,
  ShieldCheck,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { ACTIVE_CAMPAIGN_CHANGE_EVENT, campaignDashboardUrl } from "@/lib/activeCampaign"
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
      { title: "Campaign Orchestration", url: "/campaign-config", icon: Megaphone },
      { title: "Event Manager", url: "/campaign-config", icon: Calendar, infoOnly: true },
      { title: "Campaign Visibility", url: "/campaign-dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Decks",
    items: [
      { title: "Deck/Template Management", url: "/deck-management", icon: FolderOpen },
    ],
  },
  {
    title: "Analytics",
    items: [
      { title: "Campaign Analytics", url: "/campaign-analytics", icon: BarChart3 },
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
      { title: "QR & Token Tools", url: "/repoint-qr", icon: RotateCcw },
      { title: "GeoIP Test", url: "/geoip-test", icon: Globe },
      { title: "Data Template Test", url: "/data-template-test", icon: TestTube },
      { title: "Map Debug", url: "/map-debug", icon: Map },
      { title: "Simulator", url: "/simulator", icon: FlaskConical },
      { title: "System Health", url: "/edge-health", icon: HeartPulse },
      { title: "Regression Tests", url: "/regression-tests", icon: ShieldCheck },
    ],
  },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const isCollapsed = state === "collapsed"
  const [dashboardUrl, setDashboardUrl] = useState(() => campaignDashboardUrl())

  useEffect(() => {
    const refreshDashboardUrl = () => setDashboardUrl(campaignDashboardUrl())

    window.addEventListener(ACTIVE_CAMPAIGN_CHANGE_EVENT, refreshDashboardUrl)
    window.addEventListener("storage", refreshDashboardUrl)

    return () => {
      window.removeEventListener(ACTIVE_CAMPAIGN_CHANGE_EVENT, refreshDashboardUrl)
      window.removeEventListener("storage", refreshDashboardUrl)
    }
  }, [])
  
  const handleInfoOnlyClick = (e: MouseEvent, url: string) => {
    e.preventDefault()
    toast({
      title: "Select an active campaign first",
      description: "Please choose a campaign from Campaign Orchestration",
    })
    navigate(url)
  }

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
                {section.items.map((item: any) => {
                  const isActive = location.pathname === item.url || 
                    (item.url === "/deck" && location.pathname.startsWith("/deck/"))
                  const target = item.url === "/campaign-dashboard"
                    ? dashboardUrl
                    : item.url
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        {item.infoOnly ? (
                          <a href="#" onClick={(e) => handleInfoOnlyClick(e, item.url)}>
                            <item.icon />
                            <span>{item.title}</span>
                          </a>
                        ) : (
                          <NavLink to={target}>
                            <item.icon />
                            <span>{item.title}</span>
                          </NavLink>
                        )}
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
