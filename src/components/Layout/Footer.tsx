'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Youtube, Mail } from 'lucide-react';

// Enamad trust seal. Must stay byte-for-byte as issued by enamad.ir, do not
// convert to JSX, and never add rel="noopener noreferrer" (it breaks the seal).
const ENAMAD_SEAL_HTML =
  "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=7602313&Code=yceNfYPpnp6GMdLe41fcyAgvQDAtT09E'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=7602313&Code=yceNfYPpnp6GMdLe41fcyAgvQDAtT09E' alt='' style='cursor:pointer' code='yceNfYPpnp6GMdLe41fcyAgvQDAtT09E'></a>";

export default function Footer({ locale }: { locale: string }) {
  const isRtl = locale === 'fa';
  const year = new Date().getFullYear();

  const navLinks = [
    { href: `/${locale}/#projects`, label: isRtl ? 'پروژه‌ها' : 'Projects' },
    { href: `/${locale}/about`, label: isRtl ? 'درباره ما' : 'About' },
    { href: `/${locale}/contact`, label: isRtl ? 'تماس' : 'Contact' },
    { href: `/${locale}/support`, label: isRtl ? 'حمایت' : 'Support' },
  ];

  const socials = [
    { href: 'https://instagram.com', icon: <Instagram size={18} />, label: 'Instagram' },
    { href: 'https://youtube.com', icon: <Youtube size={18} />, label: 'YouTube' },
    { href: `/${locale}/contact`, icon: <Mail size={18} />, label: 'Email' },
  ];

  return (
    <footer className="border-t border-zinc-900 bg-black" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link href={`/${locale}`} className="group flex items-center gap-3 w-fit">
              <div className="relative size-9 transition-transform group-hover:rotate-[-8deg]">
                <Image
                  src="/logo-icon-white.png"
                  fill
                  sizes="36px"
                  alt="Little Black Fish Studios"
                  className="object-contain"
                />
              </div>
              <span className="font-lalezar text-lg text-white tracking-wide">
                {isRtl ? 'استودیو ماهی سیاه کوچولو' : 'Little Black Fish'}
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-zinc-500">
              {isRtl
                ? 'خلاقیت در دل محدودیت، از سینما تا انیمیشن.'
                : 'Creative storytelling from cinema to animation.'}
            </p>
            {/* Socials */}
            <div className="flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex size-11 items-center justify-center rounded-lg border border-zinc-900 text-zinc-500 transition-all hover:border-zinc-700 hover:text-white"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              {isRtl ? 'صفحات' : 'Pages'}
            </p>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative w-fit text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              >
                {link.label}
                <span className="absolute -bottom-px left-0 h-px w-0 bg-blue-500 transition-all group-hover:w-full" />
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex flex-col gap-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
              {isRtl ? 'شروع کنید' : 'Get started'}
            </p>
            <p className="max-w-[220px] text-sm text-zinc-500">
              {isRtl
                ? 'پروژه‌ای در ذهن دارید؟ با ما صحبت کنید.'
                : 'Have a project in mind? Let\'s talk.'}
            </p>
            <Link
              href={`/${locale}/contact`}
              className="w-fit rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98]"
            >
              {isRtl ? 'تماس با ما' : 'Start a project'}
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-zinc-900 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-zinc-600">
            © {year} Little Black Fish Studios.{' '}
            {isRtl ? 'تمامی حقوق محفوظ است.' : 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-4">
            <div
              className="shrink-0"
              dangerouslySetInnerHTML={{ __html: ENAMAD_SEAL_HTML }}
            />
            <div className="flex items-center gap-1 text-xs text-zinc-700">
              <span>{isRtl ? 'ساخته شده با' : 'Made with'}</span>
              <span className="text-blue-600">♥</span>
              <span>{isRtl ? 'در تهران' : 'in Tehran'}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
