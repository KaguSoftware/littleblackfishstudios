import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware({
  locales: ['en', 'fa'],
  defaultLocale: 'en'
});

export default async function proxy(req: NextRequest) {
  const { response: supabaseResponse, user } = await updateSession(req);

  const pathname = req.nextUrl.pathname;

  // Admin pages need a signed-in user with the admin role
  if (/\/(en|fa)\/admin(\/.*)?$/.test(pathname) && user?.app_metadata?.role !== 'admin') {
    const locale = pathname.match(/^\/(en|fa)/)?.[1] ?? 'en';
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  const intlResponse = intlMiddleware(req);

  supabaseResponse.cookies.getAll().forEach(cookie => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\..*).*)']
};
