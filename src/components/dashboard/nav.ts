import { CalendarDays, Home, LayoutGrid, Settings, type LucideIcon } from "lucide-react";

export type NavKey = "overview" | "properties" | "bookings" | "settings";

export const NAV: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "overview", href: "/dashboard", icon: LayoutGrid },
  { key: "properties", href: "/dashboard/proprietati", icon: Home },
  { key: "bookings", href: "/dashboard/rezervari", icon: CalendarDays },
  { key: "settings", href: "/dashboard/setari", icon: Settings },
];

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
