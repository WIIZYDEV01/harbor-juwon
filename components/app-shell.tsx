"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Avatar } from "@/components/profile-card";
import { RoleBadge } from "@/components/role-badge";
import { signOut } from "@/lib/auth/actions";
import { roleLabel, type UserRole } from "@/lib/profile/types";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profiles", label: "Directory" },
  { href: "/profile", label: "My profile" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Application" className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-md px-3 text-sm font-medium ${
              active ? "bg-paper text-ink" : "text-paper/80 hover:bg-paper/10 hover:text-paper"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  name,
  role,
  avatar,
  children,
}: {
  name: string;
  role: UserRole | null;
  avatar: { id: string; hasImage: boolean; version: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;

  return (
    <div className="min-h-full bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden bg-ink text-paper lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-4 lg:py-8">
          <p className="px-3 text-sm font-semibold uppercase tracking-[0.22em]">Harbor</p>
          <div className="mt-10">
            <NavLinks onNavigate={() => setMenuPath(null)} />
          </div>
          {role ? (
            <p className="mt-auto px-3 text-xs text-paper/60">Signed in as {roleLabel(role).toLowerCase()}</p>
          ) : null}
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/15 bg-paper/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="min-h-10 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink lg:hidden"
                onClick={() => setMenuPath(pathname)}
              >
                Menu
              </button>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ink lg:hidden">Harbor</p>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                {role ? (
                  <div className="mt-0.5 flex justify-end">
                    <RoleBadge role={role} />
                  </div>
                ) : null}
              </div>
              {avatar ? (
                <Link href="/profile" aria-label="My profile" className="rounded-full">
                  <Avatar
                    profileId={avatar.id}
                    name={name}
                    hasImage={avatar.hasImage}
                    version={avatar.version}
                  />
                </Link>
              ) : null}
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-10 rounded-md px-3 text-sm font-semibold text-ink hover:bg-ink/5"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>
          <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      {open ? (
        <Dialog title="Menu" onClose={() => setMenuPath(null)}>
          <div className="rounded-md bg-ink p-3">
            <NavLinks onNavigate={() => setMenuPath(null)} />
          </div>
          <p className="mt-3 text-sm text-ink/70">
            {name}
            {role ? ` · ${roleLabel(role)}` : ""}
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
