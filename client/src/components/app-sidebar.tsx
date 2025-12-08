import { startTransition, useState } from "react";
import { LayoutDashboard, Package, ShoppingCart, Receipt, CreditCard, TrendingUp, Settings, BarChart3, RotateCcw, ShieldCheck, ChevronDown, ArrowUpCircle, History, PackagePlus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useNavigationRefresh } from "@/hooks/use-navigation-refresh";
import { prefetchPageData } from "@/lib/queryClient";
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
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Settings as UISettings } from "@shared/schema";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  subItems?: MenuItem[];
}

const mainMenuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Stock",
    url: "/stock",
    icon: Package,
    subItems: [
      { title: "Stock In", url: "/stock/in", icon: ArrowUpCircle },
      { title: "History", url: "/stock/history", icon: History },
    ],
  },
  {
    title: "POS",
    url: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "Sales",
    url: "/sales",
    icon: Receipt,
  },
  {
    title: "Unpaid",
    url: "/unpaid-bills",
    icon: CreditCard,
  },
  {
    title: "Returns",
    url: "/returns",
    icon: RotateCcw,
    subItems: [
      { title: "History", url: "/returns/history", icon: History },
    ],
  },
];

const analyticsItems: MenuItem[] = [
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
  },
  {
    title: "Audit",
    url: "/audit",
    icon: ShieldCheck,
  },
];

const settingsItems: MenuItem[] = [
  {
    title: "Rates",
    url: "/rates",
    icon: TrendingUp,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { triggerRefresh } = useNavigationRefresh();
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    Stock: true,
    Returns: true,
  });

  const { data: settings } = useQuery<UISettings>({
    queryKey: ["/api/settings"],
  });

  const storeName = settings?.storeName ?? "PaintPulse";
  const storeInitial = storeName.charAt(0).toUpperCase();

  const handleNavClick = (url: string, e: React.MouseEvent) => {
    if (location === url) {
      e.preventDefault();
      startTransition(() => {
        triggerRefresh();
      });
    }
  };

  const handleMouseEnter = (url: string) => {
    prefetchPageData(url);
  };

  const toggleSubMenu = (title: string) => {
    setOpenSubMenus(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const isItemActive = (item: MenuItem): boolean => {
    if (location === item.url) return true;
    if (item.subItems) {
      return item.subItems.some(sub => location === sub.url);
    }
    return false;
  };

  const renderMenuItem = (item: MenuItem) => {
    const isActive = location === item.url;
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isParentActive = isItemActive(item);

    if (hasSubItems) {
      return (
        <Collapsible
          key={item.title}
          open={openSubMenus[item.title]}
          onOpenChange={() => toggleSubMenu(item.title)}
        >
          <SidebarMenuItem>
            <div className="flex items-center w-full">
              <SidebarMenuButton 
                asChild 
                data-active={isActive}
                className={`
                  flex-1 relative group transition-all duration-200
                  ${isActive 
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }
                `}
              >
                <Link 
                  href={item.url} 
                  data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={(e) => handleNavClick(item.url, e)}
                  onMouseEnter={() => handleMouseEnter(item.url)}
                >
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                    ${isActive || isParentActive 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                    }
                  `}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm">{item.title}</span>
                </Link>
              </SidebarMenuButton>
              <CollapsibleTrigger asChild>
                <button 
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  data-testid={`button-expand-${item.title.toLowerCase()}`}
                >
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openSubMenus[item.title] ? 'rotate-180' : ''}`} />
                </button>
              </CollapsibleTrigger>
            </div>
          </SidebarMenuItem>
          <CollapsibleContent>
            <div className="ml-6 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1 mt-1">
              {item.subItems?.map(subItem => {
                const isSubActive = location === subItem.url;
                return (
                  <SidebarMenuItem key={subItem.title}>
                    <SidebarMenuButton 
                      asChild 
                      data-active={isSubActive}
                      className={`
                        relative group transition-all duration-200
                        ${isSubActive 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' 
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }
                      `}
                    >
                      <Link 
                        href={subItem.url} 
                        data-testid={`link-${subItem.title.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={(e) => handleNavClick(subItem.url, e)}
                        onMouseEnter={() => handleMouseEnter(subItem.url)}
                      >
                        <subItem.icon className={`h-4 w-4 ${isSubActive ? 'text-blue-600' : ''}`} />
                        <span className="text-sm">{subItem.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton 
          asChild 
          data-active={isActive}
          className={`
            relative group transition-all duration-200
            ${isActive 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }
          `}
        >
          <Link 
            href={item.url} 
            data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={(e) => handleNavClick(item.url, e)}
            onMouseEnter={() => handleMouseEnter(item.url)}
          >
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
              }
            `}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-sm">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <SidebarHeader className="px-4 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-lg font-bold text-white">{storeInitial}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-slate-900 dark:text-white tracking-tight">{storeName}</span>
            <span className="text-xs text-slate-500 dark:text-slate-500">Paint Store POS</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-3 py-4 scrollbar-hide">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainMenuItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {analyticsItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {settingsItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <div className="text-[10px] text-slate-400 dark:text-slate-600 text-center">
          v5.1.7
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
