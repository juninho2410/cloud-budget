
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Coins,
  LayoutDashboard,
  Sheet,
  Building2,
  Target,
  Upload,
  BarChart3,
  Link2, // Icon for associations
  Receipt, // Icon for expenses
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";


const menuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/budgets", label: "Budgets", icon: Sheet },
  { href: "/expenses", label: "Expenses", icon: Receipt }, // New Expense Item
  { href: "/business-lines", label: "Business Lines", icon: Building2 },
  { href: "/cost-centers", label: "Cost Centers", icon: Target },
  { href: "/cost-center-associations", label: "Associations", icon: Link2 },
  { href: "/upload", label: "Upload Data", icon: Upload }, // Updated label
  { href: "/charts", label: "Charts", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    // Handle exact match for root, otherwise check startsWith
    return href === "/" ? pathname === href : pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon">
        <SidebarHeader className="border-b">
            {/* Sidebar Header Content if needed */}
             <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
               <Coins className="h-6 w-6" />
               <span>CloudWise</span>
             </Link>
        </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href} legacyBehavior passHref>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={item.label}
                  className="justify-start"
                >
                   <a> {/* Add anchor tag here for legacyBehavior */}
                    <item.icon className="h-4 w-4" />
                    <span className={cn(
                      "group-data-[collapsible=icon]:hidden",
                       "whitespace-nowrap" // Prevent text wrapping
                    )}>{item.label}</span>
                   </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      {/* <SidebarFooter>Footer Content</SidebarFooter> */}
    </Sidebar>
  );
}
