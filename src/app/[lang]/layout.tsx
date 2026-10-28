import { getDictionary, type Locale, locales } from '@/lib/i18n';
import type { Metadata } from 'next';

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ lang: Locale }> 
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  
  return {
    title: lang === 'es' ? 'Leo - Tu próximo piso, encontrado' : 'Leo - Your next flat, found',
    description: dict.renters.hero.subcopy,
    alternates: {
      languages: {
        es: '/es',
        en: '/en',
      },
    },
  };
}

interface LangLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}

export default async function LangLayout({ children, params }: LangLayoutProps) {
  const { lang } = await params;
  
  return (
    <html lang={lang}>
      <body>
        {children}
      </body>
    </html>
  );
}

