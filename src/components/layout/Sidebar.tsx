"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings2,
  Clock,
  Target,
  UserCheck,
  Scale,
  PlusCircle,
  History,
  FileDown,
  Settings,
  Shield,
  User,
  LogOut,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { getRolleLabel, ROLE_LEVEL, type Rolle } from "@/lib/auth/roles";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Settings2,
  Clock,
  Target,
  UserCheck,
  Scale,
  PlusCircle,
  History,
  FileDown,
  Settings,
  Shield,
  User,
};

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Nur sichtbar fuer bestimmte Mindest-Rolle */
  minRolle?: Rolle;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/schuelerzahlen", label: "Schülerzahlen", icon: "Users" },
  { href: "/slr-konfiguration", label: "SLR-Konfiguration", icon: "Settings2" },
  { href: "/deputate", label: "Deputate", icon: "Clock" },
  { href: "/stellensoll", label: "Stellensoll", icon: "Target" },
  { href: "/stellenist", label: "Stellenist", icon: "UserCheck" },
  { href: "/vergleich", label: "Soll-Ist-Vergleich", icon: "Scale" },
  { href: "/zuschlaege", label: "Zuschläge", icon: "PlusCircle" },
  { href: "/historie", label: "Historie", icon: "History" },
  { href: "/export", label: "Export", icon: "FileDown" },
  { href: "/einstellungen", label: "Einstellungen", icon: "Settings" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/benutzer", label: "Benutzerverwaltung", icon: "Shield", minRolle: "admin" },
];

interface SidebarProps {
  userName: string;
  userRolle: Rolle;
}

export function Sidebar({ userName, userRolle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
    router.refresh();
  };

  // Initiale des Benutzernamens
  const initiale = userName?.charAt(0)?.toUpperCase() ?? "?";

  // Sichtbare Admin-Items filtern
  const visibleAdminItems = ADMIN_NAV_ITEMS.filter(
    (item) => !item.minRolle || ROLE_LEVEL[userRolle] >= ROLE_LEVEL[item.minRolle]
  );

  return (
    <aside className="no-print fixed left-0 top-0 h-screen w-[280px] bg-[#575756] text-white flex flex-col overflow-y-auto">
      {/* Logo / Header */}
      <div className="px-6 py-6 border-b border-white/10">
        <div className="text-xs uppercase tracking-[3px] text-white/60 mb-1">
          CREDO Verwaltung
        </div>
        <h1 className="text-lg font-bold tracking-wide">
          Stellenberechnung
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = ICON_MAP[item.icon];

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-6 py-3 text-[15px] transition-colors
                    ${isActive
                      ? "bg-white/15 text-white font-semibold border-l-4 border-white pl-5"
                      : "text-white/75 hover:bg-white/8 hover:text-white border-l-4 border-transparent pl-5"
                    }
                  `}
                >
                  {Icon && <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin-Bereich */}
        {visibleAdminItems.length > 0 && (
          <>
            <div className="mx-6 my-3 border-t border-white/10" />
            <div className="px-6 mb-2">
              <span className="text-[10px] uppercase tracking-[2px] text-white/40 font-semibold">
                Administration
              </span>
            </div>
            <ul className="space-y-0.5">
              {visibleAdminItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = ICON_MAP[item.icon];

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-6 py-3 text-[15px] transition-colors
                        ${isActive
                          ? "bg-white/15 text-white font-semibold border-l-4 border-white pl-5"
                          : "text-white/75 hover:bg-white/8 hover:text-white border-l-4 border-transparent pl-5"
                        }
                      `}
                    >
                      {Icon && <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      {/* Benutzer-Info + Logout */}
      <div className="border-t border-white/10">
        {/* Betrachter-Hinweis */}
        {userRolle === "betrachter" && (
          <div className="mx-6 mt-3 mb-1 flex items-center gap-1.5 text-amber-300/80">
            <Eye size={14} />
            <span className="text-[11px] font-medium">Nur-Lesen-Zugriff</span>
          </div>
        )}

        {/* Benutzer-Info */}
        <div className="px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold shrink-0">
              {initiale}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{userName}</div>
              <div className="text-[11px] text-white/50">{getRolleLabel(userRolle)}</div>
            </div>
          </div>
        </div>

        {/* Profil + Logout */}
        <div className="px-6 pb-3 flex gap-2">
          <Link
            href="/profil"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-white/70
              hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <User size={14} />
            <span>Profil</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-white/70
              hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Abmelden</span>
          </button>
        </div>

        {/* CREDO Footer */}
        <div className="px-6 py-3 border-t border-white/10">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-white/40 tracking-[2px]">CREDO</span>
            <div className="flex h-1 ml-2">
              <div className="w-8 bg-[#575756]" />
              <div className="w-2 bg-[#FBC900]" />
              <div className="w-2 bg-[#6BAA24]" />
              <div className="w-2 bg-[#E2001A]" />
              <div className="w-2 bg-[#009AC6]" />
            </div>
          </div>
          <div className="text-[10px] text-white/30 mt-1">
            lebensnah &middot; wegweisend &middot; christlich
          </div>
        </div>
      </div>
    </aside>
  );
}
