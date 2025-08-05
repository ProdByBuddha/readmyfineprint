
'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const DonatePageContent = dynamic(() => import('@/components/DonatePageContent'), {
  ssr: false,
});

export default function DonatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DonatePageContent />
    </Suspense>
  );
}
