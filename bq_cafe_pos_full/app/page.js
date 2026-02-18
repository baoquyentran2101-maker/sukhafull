'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();

  const [areas, setAreas] = useState([]);
  const [activeArea, setActiveArea] = useState(null);
  const [tables, setTables] = useState([]);
  const [inUseTables, setInUseTables] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  async function loadAreas() {
    const { data, error } = await supabase
      .from('areas')
      .select('id, name, sort')
      .order('sort', { ascending: true });

    if (error) throw error;

    setAreas(data || []);
    if (!activeArea && data?.length) setActiveArea(data[0].id);
  }

  async function loadTables(areaId) {
    if (!areaId) return;
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, status, area_id')
      .eq('area_id', areaId)
      .order('name', { ascending: true });

    if (error) throw error;
    setTables(data || []);
  }

  async function loadInUseTables() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, status')
      .eq('status', 'in_use')
      .order('name', { ascending: true });

    if (error) throw error;
    setInUseTables(data || []);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!alive) return;
        setLoading(true);
        setErrMsg('');

        await loadAreas();
        await loadInUseTables();
      } catch (e) {
        console.error('Home load error:', e);
        if (!alive) return;
        setErrMsg('Không tải được dữ liệu. Vui lòng kiểm tra Supabase.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!activeArea) return;
        await loadTables(activeArea);
      } catch (e) {
        console.error('loadTables error:', e);
        if (alive) setTables([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeArea]);

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>POS - Chọn bàn</h3>

      {errMsg && (
        <div style={{ marginBottom: 10, color: '#b00020', fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {/* Block: Bàn đang sử dụng */}
      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 10,
          padding: 12,
          marginBottom: 14,
          background: '#fafafa'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 900 }}>Bàn đang sử dụng</div>
          <div style={{ fontSize: 12, color: '#666' }}>{inUseTables.length} bàn</div>
        </div>

        {inUseTables.length === 0 ? (
          <div style={{ marginTop: 8, color: '#666' }}>Không có bàn nào đang sử dụng.</div>
        ) : (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {inUseTables.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/table/${t.id}`)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid #ddd',
                  background: '#fff3e0',
                  cursor: 'pointer',
                  fontWeight: 800
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Khu */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Khu</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveArea(a.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: activeArea === a.id ? '2px solid #1976d2' : '1px solid #ccc',
                background: activeArea === a.id ? '#e3f2fd' : '#fff',
                cursor: 'pointer'
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bàn trong khu */}
      <div>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Bàn trong khu</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/table/${t.id}`)}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 10,
                textAlign: 'center',
                cursor: 'pointer',
                background: t.status === 'empty' ? '#e8fff0' : '#fff3e0'
              }}
              title="Mở order"
            >
              <div style={{ fontWeight: 900 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{t.status === 'empty' ? 'Trống' : 'Đang dùng'}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
<button onClick={() => router.push('/menu')}>
  Quản lý Menu
</button>
