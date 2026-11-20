import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

const NAV_LINKS = [
  { to: "/for-businesses", label: "For Businesses" },
  { to: "/for-notaries", label: "For Notaries" },
  { to: "/contact", label: "Contact" },
] as const;

// Businesses and notaries have separate accounts, so each gets its own entry
// point (and its own session cookie — see ~/lib/auth and ~/lib/notary-auth).
const LOGIN_LINKS = [
  { to: "/login", label: "Business log in" },
  { to: "/notary/login", label: "Notary log in" },
] as const;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "C Breeze Notary and Signing — Reliable Loan Signings Anywhere",
      },
      {
        name: "description",
        content:
          "Managed notary loan signing service. Title companies, lenders & escrow firms post a job and we assign a vetted local notary. No hunting, no no-shows.",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="btn-primary mt-6"
        >
          Go home
        </Link>
      </div>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Navbar />
      <Outlet />
      <Footer />
    </RootDocument>
  );
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 shadow-sm shadow-slate-900/5 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-5 py-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src="/cbreeze-logo.png"
            alt="C Breeze Notary and Signing"
            className="h-11 w-auto"
          />
        </Link>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="hidden items-center gap-5 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-slate-700 hover:text-teal-700"
              >
                {link.label}
              </Link>
            ))}
            <span
              className="h-4 w-px bg-slate-200"
              aria-hidden="true"
            />
            {LOGIN_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-slate-700 hover:text-teal-700"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <Link
            to="/notary/signup"
            className="hidden text-sm font-medium text-slate-700 hover:text-teal-700 lg:inline"
          >
            Notary sign up
          </Link>

          <Link to="/signup" className="btn-primary px-4 py-2 text-sm">
            Sign up
          </Link>

          {/* Mobile menu toggle — the links above are hidden below md. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 p-2 text-slate-700 transition hover:border-teal-600 hover:bg-teal-50 md:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
              aria-hidden="true"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav"
            className="basis-full border-t border-slate-200 pt-3 md:hidden"
          >
            <div className="flex flex-col">
              {[
                ...NAV_LINKS,
                ...LOGIN_LINKS,
                { to: "/signup", label: "Business sign up" } as const,
                { to: "/notary/signup", label: "Notary sign up" } as const,
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-wash">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <img
              src="/cbreeze-logo.png"
              alt="C Breeze Notary and Signing"
              className="h-12 w-auto mix-blend-multiply"
            />
            <p className="mt-2 text-sm text-slate-600">
              Reliable loan document signings, anywhere in the United States.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Quick Links</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/for-businesses"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  For Businesses
                </Link>
              </li>
              <li>
                <Link
                  to="/for-notaries"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  For Notaries
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  to="/notary/signup"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  Notary Sign Up
                </Link>
              </li>
              <li>
                <Link
                  to="/notary/login"
                  className="text-sm text-slate-600 hover:text-teal-700"
                >
                  Notary Log In
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Contact</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>609-547-9169</li>
              <li>
                <a
                  href="https://www.facebook.com/SignWithCBreeze/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900"
                >
                  Facebook
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
          &copy; {new Date().getFullYear()} C Breeze Notary and Signing. All
          rights reserved.
        </div>
      </div>
    </footer>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">{children}</body>
      <Scripts />
    </html>
  );
}
