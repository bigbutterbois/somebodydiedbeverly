import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <LoginForm />
    </main>
  );
}
