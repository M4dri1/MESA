'use client';

import dynamic from 'next/dynamic';
import { MesaProvider } from '@/context/MesaContext';

// Dynamically import MainApp with SSR false so mediaDevices and browser APIs run cleanly
const MainApp = dynamic(
  () => import('@/components/MainApp').then((mod) => mod.MainApp),
  { ssr: false }
);

export default function Home() {
  return (
    <MesaProvider>
      <MainApp />
    </MesaProvider>
  );
}

