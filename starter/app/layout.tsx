import './styles.css';
export const metadata = {title: 'Leo.casa — Home matching example', description: 'The original recommendation scene with fictional homes and deterministic fit scores.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}
