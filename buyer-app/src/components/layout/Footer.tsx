import Link from "next/link";
import { Logo } from "./Logo";
import {
  FacebookIcon,
  InstagramIcon,
  MastercardMark,
  RuPayMark,
  UpiMark,
  VisaMark,
  XIcon,
  YouTubeIcon,
} from "./footerIcons";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/" },
  { label: "Categories", href: "#" },
  { label: "Offers", href: "#" },
];

const CUSTOMER_SERVICE_LINKS = [
  { label: "Contact Us", href: "#" },
  { label: "FAQ", href: "#" },
  { label: "Shipping Information", href: "#" },
  { label: "Returns & Refunds", href: "#" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", Icon: FacebookIcon },
  { label: "Instagram", Icon: InstagramIcon },
  { label: "X", Icon: XIcon },
  { label: "YouTube", Icon: YouTubeIcon },
];

const PAYMENT_MARKS = [VisaMark, MastercardMark, RuPayMark, UpiMark];

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-900 text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Logo />
            <p className="mt-3 text-sm text-neutral-400">
              India-first electronics and accessories, at prices that make sense.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              {QUICK_LINKS.map((link) =>
                link.href === "#" ? (
                  <li key={link.label}>
                    <a className="hover:text-primary-400" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link className="hover:text-primary-400" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Customer Service
            </h3>
            <ul className="space-y-2 text-sm">
              {CUSTOMER_SERVICE_LINKS.map((link) => (
                <li key={link.label}>
                  <a className="hover:text-primary-400" href={link.href}>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              Follow Us
            </h3>
            <div className="flex gap-2">
              {SOCIAL_LINKS.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-800 text-neutral-300 hover:bg-primary-600 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-white uppercase">
              We Accept
            </h3>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MARKS.map((Mark, index) => (
                <Mark key={index} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-neutral-800 pt-6 text-xs text-neutral-500 sm:flex-row">
          <p>© 2026 TechCart. All rights reserved.</p>
          <div className="flex gap-4">
            <a className="hover:text-primary-400" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-primary-400" href="#">
              Terms &amp; Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
