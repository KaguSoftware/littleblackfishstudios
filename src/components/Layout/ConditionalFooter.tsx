'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function ConditionalFooter({ locale }: { locale: string }) {
  const pathname = usePathname();
  const isAdminPage = pathname.includes(`/${locale}/admin`);
  const isLoginPage = pathname.includes(`/${locale}/login`);

  if (isAdminPage || isLoginPage) return null;

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
