import { AuthForm } from "@/components/auth-form";
import { AuthLink, AuthScreen } from "@/components/auth-screen";
import { StateMessage } from "@/components/state-message";
import { safeNextPath } from "@/lib/auth/paths";
import { NOTICES, readCodedMessage } from "@/lib/profile/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string; error?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const notice = readCodedMessage(NOTICES, params.notice);

  return (
    <AuthScreen
      title="Sign in"
      footer={
        <>
          Need an account? <AuthLink href="/signup">Create one</AuthLink>
        </>
      }
    >
      <div className="space-y-4">
        {notice ? <StateMessage tone="success">{notice}</StateMessage> : null}
        {params.error ? (
          <StateMessage tone="error">Sign in failed. Check your email and password.</StateMessage>
        ) : null}
        <AuthForm mode="signin" nextPath={nextPath} />
      </div>
    </AuthScreen>
  );
}
