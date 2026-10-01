import Link from "next/link";
import { primaryButton } from "@/components/styles";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-full items-center bg-paper px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm font-semibold tracking-[0.22em] uppercase text-ink">Harbor</p>
        <h1 className="mt-6 text-3xl font-semibold text-ink">Unauthorized</h1>
        <p className="mt-3 text-base leading-7 text-ink/80">
          You don&apos;t have permission to view this profile.
        </p>
        <Link href="/dashboard" className={`${primaryButton} mt-8`}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
