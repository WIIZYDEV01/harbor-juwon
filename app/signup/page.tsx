import { AuthForm } from "@/components/auth-form";
import { AuthLink, AuthScreen } from "@/components/auth-screen";

export default function SignupPage() {
  return (
    <AuthScreen
      title="Create account"
      footer={
        <>
          Already registered? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <AuthForm mode="signup" />
    </AuthScreen>
  );
}
