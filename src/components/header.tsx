import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { FounderAvatar } from "./founder-avatar";
import { Search } from "lucide-react";

export async function Header() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-(--container-page) items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand + Live Community Stats */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            {/* Custom geometric logo mark */}
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg text-white shadow-xs transition-transform group-hover:scale-105">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-white"
              >
                <path
                  d="M12 3L20 17H4L12 3Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                />
                <path
                  d="M12 7L17 17H7L12 7Z"
                  fill="currentColor"
                  className="text-accent"
                />
                <circle cx="12" cy="14" r="2" fill="white" />
              </svg>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-fg">
              Founder<span className="text-accent">Up</span>
            </span>
          </Link>
        </div>

        {/* Right Navigation */}
        <nav className="flex items-center gap-1 text-[14px] font-medium sm:gap-2">
          <Link
            href="/#leaderboard"
            className="hidden rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-fg transition-colors sm:inline-flex"
          >
            Leaderboard
          </Link>

          <Link
            href="/about"
            className="hidden rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-fg transition-colors sm:inline-flex"
          >
            About
          </Link>

          <Link
            href="/rules"
            className="hidden rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-fg transition-colors sm:inline-flex"
          >
            Rules
          </Link>

          <Link
            href="/search"
            aria-label="Search founders"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
          >
            <Search className="h-4 w-4" />
          </Link>

          {profile ? (
            <div className="ml-1 flex items-center gap-2">
              <Link
                href="/dashboard"
                className="hidden rounded-lg bg-surface border border-border px-3 py-1.5 text-fg hover:border-border-strong transition-colors sm:inline-flex"
              >
                Dashboard
              </Link>
              <Link
                href={`/${profile.username}`}
                className="rounded-full ring-2 ring-transparent hover:ring-accent/20 transition-all"
                aria-label="Your profile"
              >
                <FounderAvatar
                  src={profile.avatar_url}
                  name={profile.full_name}
                  size={32}
                />
              </Link>
            </div>
          ) : (
            <div className="ml-1 flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/join"
                className="rounded-lg px-3 py-1.5 text-fg hover:bg-surface transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/join"
                className="hidden sm:inline-flex items-center justify-center rounded-lg bg-fg px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-black transition-colors"
              >
                Get ranked
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
