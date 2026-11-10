import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Owner sign-in: Trustall" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-5 pb-16 pt-12">
      <p className="text-5xl" aria-hidden>
        🔑
      </p>
      <h1 className="mt-4 text-5xl">Owner sign-in</h1>
      <p className="mt-3 text-moss">
        Customers never sign in. This is for the person who runs the stall. The demo stall&apos;s passcode is in
        the project README.
      </p>
      <LoginForm />
      <p className="mt-8">
        No stall yet?{" "}
        <Link href="/owner/setup" className="font-bold underline decoration-2 underline-offset-4">
          Set one up from a photo
        </Link>
      </p>
    </main>
  );
}
