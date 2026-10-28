import {sampleBodyWithinLimit,forwardedGuestCookie} from '@/lib/sample/request.mjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['es', 'en'];
const defaultLocale = 'es';

// Paths that should not be redirected
const excludedPaths = [
  '/api',
  '/property',
  '/add-property',
  '/client-scraper',
  '/test-',
  '/_next',
  '/images',
  '/favicon',
  '/login',
];

function getLocale(request: NextRequest): string {
  // Check if there's a locale cookie
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value;
  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2));
    
    for (const locale of preferredLocales) {
      if (locales.includes(locale)) {
        return locale;
      }
    }
  }

  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if(process.env.SAMPLE_MODE==='1') {
    const allowedApis=['/api/sample/query','/api/sample/session','/api/recommender/profile','/api/recommender/generate','/api/catalogue','/api/saved','/api/viewings','/api/notes','/api/user/settings','/api/profile/switch','/api/profile/create'];
    const base=request.nextUrl.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '';
    const path=base&&pathname.startsWith(base+'/')?pathname.slice(base.length):pathname;
    if(!path.startsWith('/api/')&&(path.startsWith('/_next/')||path.startsWith('/images/')||path.startsWith('/fonts/')||/\.(?:ico|png|webp|jpg|svg|css|js|woff2?|ttf)$/.test(path)))return NextResponse.next();
    if(path.startsWith('/api/')&&!allowedApis.includes(path)&&!/^\/api\/property\/[a-zA-Z0-9-]+\/(notes|viewing)$/.test(path)) {
      return NextResponse.json({error:'Configura tu proveedor para esta acción.',code:'RECIPIENT_SERVICE_REQUIRED'},{status:503});
    }
    if(path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const origin=request.headers.get('origin');
      try {
        if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&new URL(origin).host!==request.headers.get('host')))return NextResponse.json({error:'Usa el origen de la aplicación.'},{status:403});
      }catch{return NextResponse.json({error:'Revisa el origen de la solicitud.'},{status:403});}
      if(!await sampleBodyWithinLimit(request))return NextResponse.json({error:'Usa una solicitud de hasta 32 KiB.'},{status:413});
    }
    let guest=request.cookies.get('leo_home_sample_guest')?.value;
    const fresh=!guest||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(guest);
    if(fresh)guest=crypto.randomUUID();
    const headers=new Headers(request.headers);
    if(fresh)headers.set('cookie',forwardedGuestCookie(headers.get('cookie'),guest));
    let response;
    if(path==='/'||path==='/es'||path==='/en'||path==='/auth/signin') {
      const target=request.nextUrl.clone();
      const publicHost=request.headers.get('x-forwarded-host')||request.headers.get('host');
      if(publicHost&&!/[\\/@#?\s,]/.test(publicHost))target.host=publicHost;
      if(request.headers.get('x-forwarded-proto')==='https')target.protocol='https:';
      target.pathname='/dashboard';
      response=NextResponse.redirect(target);
    }else response=NextResponse.next({request:{headers}});
    if(fresh)response.cookies.set('leo_home_sample_guest',guest!,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:'||request.headers.get('x-forwarded-proto')==='https',path:base||'/',maxAge:12*60*60});
    return response;
  }

  // Skip excluded paths
  if (excludedPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if the pathname already has a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Redirect to default locale for root path
  if (pathname === '/') {
    const locale = getLocale(request);
    const response = NextResponse.redirect(new URL(`/${locale}`, request.url));
    response.cookies.set('NEXT_LOCALE', locale);
    return response;
  }

  // For other paths without locale, continue as normal (they're probably other routes)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

