"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  Building2,
  Car,
  CreditCard,
  LayoutDashboard,
  LineChart,
  Package,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/modules/shared/components/language-switcher";
import { ThemeToggle } from "@/modules/shared/components/theme-toggle";
import { SignOutButton } from "@/modules/shared/components/sign-out-button";
import { Separator } from "@/components/ui/separator";

const nav = [
  { href: "/admin/dashboard", key: "adminDashboard", icon: LayoutDashboard },
  { href: "/admin/dealers", key: "adminDealers", icon: Building2 },
  { href: "/admin/packages", key: "adminPackages", icon: Package },
  { href: "/admin/listings", key: "adminListings", icon: Car },
  { href: "/admin/payments", key: "adminPayments", icon: CreditCard },
  { href: "/admin/reports", key: "adminReports", icon: LineChart },
  { href: "/admin/config/brands", key: "adminConfig", icon: Settings2 },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/60 p-4 shadow-soft md:block">
        <div className="mb-8 px-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tCommon("appName")}
          </div>
          <div className="text-lg font-semibold text-foreground">
            {t("systemAdmin")}
          </div>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 backdrop-blur">
          <div className="text-sm text-muted-foreground md:hidden">
            {tCommon("appName")}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6" />
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
