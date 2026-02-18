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

  // ===== LOAD AREAS =====
  async function loadAreas() {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .order('sort', { ascending: true });

    if (error) throw error;

    setAreas(data || []);
    if (!activeArea && data?.length) {
      setActiveArea(data[0].id);
    }
  }

  // ===== LOAD TABLES IN AREA =====
  async function loadTables(areaId) {
    if (!areaId) return;

    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('area_id', areaId)
      .order('name', { ascending: true });

    if (error) throw error;

    setTables(data || []);
  }

  // ===== LOAD IN USE TABLES =====
  async function loadInUseTables() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('status', 'in_use')
      .order('name', { ascending: true });

    if (error) throw error;

    setInUseTables(data || []);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrMsg('');

        await loadAreas();
        await loadInUseTables();
      } catch (e) {
        console.error('Home load error:', e);
        if (alive) setErrMsg('Không tải được dữ liệu.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    loadTables(activeArea);
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
        <div style={{ color: 'red', marginBottom: 10 }}>
          {errMsg}
        </div>
      )}

      {/* ===== BÀN ĐANG SỬ DỤNG ===== */}
      <div
        style={{
          border: '1px solid #eee',
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          background: '#fafafa'
        }}
      >
        <h4>Bàn đang sử dụng</h4>

        {inUseTables.length === 0 && <div>Không có bàn nào.</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {inUseTables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/table/${t.id}`)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: '1px solid #ddd',
                cursor: 'pointer',
                background: '#fff3e0'
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== KHU ===== */}
      <div style={{ marginBottom: 20 }}>
        <h4>Khu</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveArea(a.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: activeArea === a.id ? '2px solid #1976d2' : '1px solid #ccc',
                cursor: 'pointer'
              }}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* ===== BÀN TRONG KHU ===== */}
      <div>
        <h4>Bàn trong khu</h4>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 10
          }}
        >
          {tables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/table/${t.id}`)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid #ddd',
                cursor: 'pointer',
                background: t.status === 'empty' ? '#e8fff0' : '#fff3e0'
              }}
            >
              <div style={{ fontWeight: 700 }}>{t.name}</div>
              <div style={{ fontSize: 12 }}>
                {t.status === 'empty' ? 'Trống' : 'Đang dùng'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ===== NÚT QUẢN LÝ MENU ===== */}
      <div style={{ marginTop: 30 }}>
        <button
          onClick={() => router.push('/menu')}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid #ddd',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Quản lý Menu
        </button>
      </div>
    </main>
  );
}
