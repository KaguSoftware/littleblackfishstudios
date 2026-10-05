'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function ConditionalFooter({ locale }: { locale: string }) {
  const pathname = usePathname();
  const isAdminPage = pathname.includes(`/${locale}/admin`);
  const isLoginPage = pathname.includes(`/${locale}/login`);
  // The projects sphere fills the viewport and never scrolls, so it has no footer.
  // Project pages under it (/projects/<slug>) keep theirs.
  const isSpherePage = pathname === `/${locale}/projects` || pathname === `/${locale}/projects/`;

  if (isAdminPage || isLoginPage || isSpherePage) return null;

  // The support page fits one screen on desktop, so the footer only shows on mobile.
  if (pathname.includes(`/${locale}/support`)) {
    return (
      <div className="desk:hidden">
        <Footer locale={locale} />
      </div>
    );
  }

  return <Footer locale={locale} />;
}
