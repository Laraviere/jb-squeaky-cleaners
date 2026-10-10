import Image from "next/image";
import Link from "next/link";
export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <Image
          src="/branding/jb-squeaky-header-logo.png"
          alt="JB Squeaky Cleaners"
          width={1916}
          height={821}
          sizes="240px"
          className="admin-auth-logo"
        />
        <p className="admin-eyebrow">Private staff portal</p>
        <h1>{title}</h1>
        {children}
        <Link href="/" className="admin-back-link">
          Back to public website
        </Link>
      </div>
    </main>
  );
}
