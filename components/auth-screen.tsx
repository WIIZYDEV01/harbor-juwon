import Link from "next/link";

export function AuthScreen({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-full bg-paper lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]">
      <section className="hidden flex-col justify-between bg-ink px-12 py-14 text-paper lg:flex">
        <p className="text-sm font-semibold tracking-[0.22em] uppercase">Harbor</p>
        <div className="max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">Staff directory</h2>
          <p className="mt-4 text-sm leading-6 text-paper/75">
            Sign in to open names, roles, and photos.
          </p>
        </div>
        <p className="text-xs text-paper/60">New accounts start as members.</p>
      </section>
      <main className="flex items-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-sm font-semibold tracking-[0.22em] uppercase text-ink lg:hidden">
            Harbor
          </p>
          <h1 className="mt-6 text-3xl font-semibold text-ink lg:mt-0">{title}</h1>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-sm text-ink/70">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-ink underline">
      {children}
    </Link>
  );
}
