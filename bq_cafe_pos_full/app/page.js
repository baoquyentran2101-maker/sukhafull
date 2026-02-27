'use client';

import { useEffect, useMemo, useState } from 'react';
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
      setErrMsg('');
      await loadTables();
      setLoading(false);
    })();
  }, []);

  const inUseTables = useMemo(() => tables.filter((t) => t.status === 'in_use'), [tables]);
  const emptyTables = useMemo(() => tables.filter((t) => t.status !== 'in_use'), [tables]);

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>BQ Café POS</h2>
          <div style={{ fontSize: 12, color: '#666' }}>Dashboard</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => router.push('/menu')}>Quản lý menu</button>
          <button onClick={() => router.push('/areas')}>Khu vực</button>
          <button onClick={() => router.push('/history')}>Lịch sử thanh toán</button>
          <button onClick={loadTables}>Tải lại</button>
        </div>
      </div>

      {errMsg && <div style={{ color: '#b00020', marginTop: 10 }}>{errMsg}</div>}

      {/* Bàn đang sử dụng */}
      <section style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Bàn đang sử dụng</h3>

        {inUseTables.length === 0 ? (
          <div style={{ color: '#666' }}>Không có bàn nào đang sử dụng.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12
            }}
          >
            {inUseTables.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/table/${t.id}`)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #f3c2c2',
                  background: '#ffe0e0',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <div>Bàn {t.name}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Đang sử dụng</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Tất cả bàn */}
      <section style={{ marginTop: 22 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Tất cả bàn</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12
          }}
        >
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/table/${t.id}`)}
              style={{
                padding: 14,
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

        {emptyTables.length === 0 && tables.length > 0 && (
          <div style={{ marginTop: 10, color: '#666' }}>Hiện không còn bàn trống.</div>
        )}
      </section>
    </main>
  );
}
