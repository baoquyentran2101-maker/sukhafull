'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  async function loadTables() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, status')
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setErrMsg('Không tải được danh sách bàn.');
      return;
    }

    setTables(data || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTables();
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Chọn bàn</h2>

      {errMsg && (
        <div style={{ color: 'red', marginBottom: 10 }}>
          {errMsg}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
          marginTop: 16
        }}
      >
        {tables.map((t) => (
          <button
            key={t.id}
            onClick={() => router.push(`/table/${t.id}`)}
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid #ddd',
              background: t.status === 'in_use' ? '#ffe0e0' : '#e8f5e9',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <div>Bàn {t.name}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {t.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
