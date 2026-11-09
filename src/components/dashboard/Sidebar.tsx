"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Globe, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { iconButton } from "@/components/ui/soft";
import { NAV, isActive } from "./nav";
import { PendingBadge, PendingBadgeProvider, PendingBadgeText, usePendingBadgeId } from "./requests/badge";

/*
  Dashboard navigation.
  - < 768 px: hidden; the ☰ button in the page header opens a drawer.
  - 768-1279 px: a glass capsule with icon tiles only (label as tooltip).
  - >= 1280 px: the same capsule with labels.
  The drawer stays mounted (inert when closed) so it can slide with a CSS transition.
*/

type DrawerCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Close because a drawer link to another page was chosen; focus returns to the new page's ☰. */
  closeForNavigation: () => void;
  /** Called by a freshly mounted ☰: true once if it should take focus. */
  claimFocus: () => boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};
const DrawerContext = createContext<DrawerCtx | null>(null);

function useDrawer() {
  const ctx = use(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be used inside DashboardNav");
  return ctx;
}

type Slots = { account: React.ReactNode; signOut: (formData: FormData) => Promise<void> };

export function DashboardNav({ children, account, signOut }: Slots & { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // ☰ lives in each page's header, so it remounts on navigation; this flag carries the focus across.
  const focusAfterNav = useRef(false);
  const pathname = usePathname();

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    // Focus goes back to ☰ when the drawer closes on the same page.
    if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const closeForNavigation = useCallback(() => {
    focusAfterNav.current = true;
    setOpenState(false);
  }, []);

  const claimFocus = useCallback(() => {
    if (!focusAfterNav.current) return false;
    focusAfterNav.current = false;
    return true;
  }, []);

  // After the route commits, the new ☰ is attached: give it focus.
  useEffect(() => {
    if (!focusAfterNav.current) return;
    const id = requestAnimationFrame(() => {
      const el = triggerRef.current;
      if (el?.isConnected && claimFocus()) el.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, claimFocus]);

  return (
    <DrawerContext value={{ open, setOpen, closeForNavigation, claimFocus, triggerRef }}>
      <PendingBadgeProvider>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh shrink-0 py-4 pl-4 md:block xl:py-6 xl:pl-6">
          <Rail account={account} signOut={signOut} />
        </aside>
        {/* The page behind the open phone drawer is inert: no focus, no screen reader, no clicks. */}
        <div className="min-w-0 flex-1" inert={open}>
          {children}
        </div>
      </div>
      <Drawer account={account} signOut={signOut} />
      </PendingBadgeProvider>
    </DrawerContext>
  );
}

const glass = "border border-glass-line bg-glass shadow-glass backdrop-blur-xl backdrop-saturate-150";

function Brand({ compact }: { compact: boolean }) {
  const t = useTranslations("Dashboard");
  return (
    <Link
      href="/dashboard"
      className={`flex items-center gap-3 rounded-inner focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${compact ? "justify-center" : "px-1"}`}
      aria-label={compact ? t("brand") : undefined}
    >
      <Image src="/logo.png" alt="" width={88} height={88} sizes="44px" className="size-11 shrink-0 rounded-full shadow-pill" />
      {!compact && (
        <span className="leading-tight">
          <span className="block font-brand text-[17px] font-semibold text-ink">{t("brand")}</span>
          <span className="block text-xs font-medium text-ink-soft">{t("brandSub")}</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ variant, onNavigate }: { variant: "rail" | "full"; onNavigate?: (href: string) => void }) {
  const t = useTranslations("Dashboard.nav");
  const pathname = usePathname();
  const rail = variant === "rail";
  const badgeId = usePendingBadgeId(`pending-badge-${variant}`);

  return (
    <ul className="space-y-1.5">
      {NAV.map(({ key, href, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={key}>
            <Link
              href={href}
              onClick={onNavigate ? () => onNavigate(href) : undefined}
              aria-current={active ? "page" : undefined}
              aria-describedby={key === "bookings" ? badgeId : undefined}
              title={rail ? t(key) : undefined}
              className={`group flex items-center gap-3 rounded-[1.1rem] p-1.5 text-[15px] transition-[background-color,color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                rail ? "max-xl:justify-center xl:pr-4" : "pr-4"
              } ${active ? "font-semibold text-ink" : "font-medium text-ink-soft hover:bg-cream-50/60 hover:text-ink"}`}
            >
              <span
                className={`relative grid size-11 shrink-0 place-items-center rounded-[0.95rem] transition-[background-color,color,box-shadow,scale] duration-200 group-active:scale-[0.96] ${
                  active ? "bg-accent text-cream-50 shadow-accent" : "bg-cream-50/80 text-ink shadow-pill"
                }`}
              >
                <Icon className="size-[19px]" strokeWidth={active ? 2.25 : 1.9} aria-hidden />
                {key === "bookings" && <PendingBadge />}
              </span>
              <span className={rail ? "max-xl:sr-only" : undefined}>{t(key)}</span>
            </Link>
            {key === "bookings" && <PendingBadgeText id={`pending-badge-${variant}`} />}
          </li>
        );
      })}
    </ul>
  );
}

// „Înapoi la site": duce la pagina publică (cazările), ca pentru un vizitator.
function BackToSite({ compact }: { compact: boolean }) {
  const t = useTranslations("Dashboard.nav");
  return (
    <div className="mt-4 border-t border-sand/70 pt-4">
      <Link
        href="/"
        title={compact ? t("site") : undefined}
        className={`group flex items-center gap-3 rounded-[1.1rem] p-1.5 text-[15px] font-medium text-ink-soft transition-[background-color,color] duration-200 hover:bg-cream-50/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          compact ? "max-xl:justify-center xl:pr-4" : "pr-4"
        }`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-[0.95rem] bg-cream-50/80 text-ink shadow-pill transition-[scale] duration-200 group-active:scale-[0.96]">
          <Globe className="size-[19px]" strokeWidth={1.9} aria-hidden />
        </span>
        <span className={compact ? "max-xl:sr-only" : undefined}>{t("site")}</span>
      </Link>
    </div>
  );
}

// Day / night switch, in the menu under „Înapoi la site" (it used to sit next to the page title).
function ThemeRow({ compact }: { compact: boolean }) {
  const t = useTranslations("Header");
  const { theme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? t("lightMode") : t("darkMode");
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={compact ? label : undefined}
      aria-label={label}
      className={`group mt-1 flex w-full items-center gap-3 rounded-[1.1rem] p-1.5 text-[15px] font-medium text-ink-soft transition-[background-color,color] duration-200 hover:bg-cream-50/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        compact ? "max-xl:justify-center xl:pr-4" : "pr-4"
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[0.95rem] bg-cream-50/80 shadow-pill transition-[scale] duration-200 group-active:scale-[0.96]">
        {dark ? <Moon className="size-[19px] text-accent" strokeWidth={1.9} aria-hidden /> : <Sun className="size-[19px] text-star" strokeWidth={1.9} aria-hidden />}
      </span>
      <span className={compact ? "max-xl:sr-only" : undefined}>{label}</span>
    </button>
  );
}

function SignOutButton({ signOut, compact }: { signOut: Slots["signOut"]; compact: boolean }) {
  const t = useTranslations("Dashboard");
  // Plain server-action form (works before hydration too); the action redirects to /login.
  // A client redirect only hides the dashboard routes (they stay in the DOM, and Back shows
  // them again), so once a sign-out was submitted and this button leaves the screen, load
  // /login as a new document instead (replace: Back skips the signed-out page).
  const submitted = useRef(false);
  useEffect(
    () => () => {
      if (submitted.current) window.location.replace("/login");
    },
    [],
  );
  return (
    <form action={signOut} onSubmit={() => (submitted.current = true)}>
      <SettledWatch onSettled={() => (submitted.current = false)} />
      <button
        type="submit"
        title={t("signOut")}
        className={`flex min-h-11 w-full items-center gap-3 rounded-[1.1rem] p-1.5 text-[15px] font-medium text-ink-soft transition-colors duration-200 hover:bg-cream-50/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          compact ? "max-xl:justify-center" : ""
        }`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-[0.95rem]">
          <LogOut className="size-[18px]" aria-hidden />
        </span>
        <span className={compact ? "max-xl:sr-only" : undefined}>{t("signOut")}</span>
      </button>
    </form>
  );
}

// A sign-out that worked leaves the dashboard while the form is still pending. If the form goes idle
// and this is still mounted, the action returned without redirecting (sign-out failed): the next
// unmount must not force /login.
function SettledWatch({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending) onSettled();
    was.current = pending;
  }, [pending, onSettled]);
  return null;
}

function Rail({ account, signOut }: Slots) {
  const t = useTranslations("Dashboard.nav");
  return (
    <nav
      aria-label={t("label")}
      className={`${glass} flex h-full w-[5.25rem] flex-col rounded-[2rem] px-2.5 py-5 xl:w-60 xl:px-3.5`}
    >
      <div className="xl:hidden">
        <Brand compact />
      </div>
      <div className="max-xl:hidden">
        <Brand compact={false} />
      </div>
      <div className="mt-9 flex-1">
        <NavList variant="rail" />
        <BackToSite compact />
        <ThemeRow compact />
      </div>
      <div className="space-y-1 border-t border-sand/70 pt-3">
        <div className="max-xl:[&_[data-account-name]]:sr-only max-xl:[&>*]:justify-center">{account}</div>
        <SignOutButton signOut={signOut} compact />
      </div>
    </nav>
  );
}

function Drawer({ account, signOut }: Slots) {
  const t = useTranslations("Dashboard.nav");
  const { open, setOpen, closeForNavigation } = useDrawer();
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lastPath = useRef(pathname);

  // Close when the route changes (e.g. browser back while open).
  useEffect(() => {
    if (lastPath.current !== pathname && open) setOpen(false);
    lastPath.current = pathname;
  }, [pathname, open, setOpen]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a[aria-current='page'], a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // Keep Tab inside the drawer while it is open.
      if (e.key === "Tab" && panelRef.current) {
        const items = panelRef.current.querySelectorAll<HTMLElement>("a, button");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, setOpen]);

  return (
    <div className="md:hidden" inert={!open} aria-hidden={!open}>
      <div
        data-testid="drawer-backdrop"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        ref={panelRef}
        id="dashboard-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("label")}
        className={`fixed inset-y-3 left-3 z-50 flex w-[min(18rem,calc(100vw-4.5rem))] flex-col rounded-[2rem] border border-glass-line bg-glass-strong px-3.5 py-5 shadow-glass backdrop-blur-2xl backdrop-saturate-150 transition-[translate,opacity] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open ? "translate-x-0 opacity-100 duration-300" : "-translate-x-[calc(100%+1rem)] opacity-0 duration-200"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <Brand compact={false} />
          <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} title={t("close")} className={`${iconButton} size-11`}>
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
        <nav aria-label={t("label")} className="mt-8 flex-1">
          <NavList variant="full" onNavigate={(href) => (href === pathname ? setOpen(false) : closeForNavigation())} />
          <BackToSite compact={false} />
          <ThemeRow compact={false} />
        </nav>
        <div className="space-y-1 border-t border-sand/70 pt-3">
          {account}
          <SignOutButton signOut={signOut} compact={false} />
        </div>
      </div>
    </div>
  );
}

// ☰ in the page header, phone only.
export function MenuButton() {
  const t = useTranslations("Dashboard.nav");
  const { open, setOpen, claimFocus, triggerRef } = useDrawer();
  // A ☰ mounted by a drawer navigation takes focus (fallback if the route effect ran before it attached).
  useEffect(() => {
    if (claimFocus()) triggerRef.current?.focus();
  }, [claimFocus, triggerRef]);
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t("open")}
      title={t("open")}
      aria-expanded={open}
      aria-controls="dashboard-drawer"
      className={`${iconButton} size-12 md:hidden`}
    >
      <Menu className="size-5" aria-hidden />
    </button>
  );
}
