'use client';

import { Suspense } from 'react';
import BlogContentClient from '@/components/BlogContentClient';

export default function BlogPage() {
  return (
    <Suspense fallback={<div>Loading blog...</div>}>
      <BlogContentClient />
    </Suspense>
  );
}
