'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HistoryIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/history/today');
  }, [router]);

  return (
    <main style={{ padding: 16 }}>
      <div>Đang chuyển tới lịch sử hôm nay...</div>
    </main>
  );
}
