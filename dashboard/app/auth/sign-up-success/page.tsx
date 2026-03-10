export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          Thank you for signing up!
        </h1>
        <p className="text-sm text-muted-foreground">Check your email to confirm</p>
      </div>
      <p className="text-sm text-muted-foreground">
        You&apos;ve successfully signed up. Please check your email to
        confirm your account before signing in.
      </p>
    </div>
  );
}
