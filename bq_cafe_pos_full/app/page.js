'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

function fmtVND(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' đ';
}

export default function HomePage() {
  const router = useRouter();

  const [areas, setAreas] = useState([]);
  const [activeArea, setActiveArea] = useState(null);
  const [tables, setTables] = useState([]);
  const [busyTables, setBusyTables] = useState([]);

  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingBusy, setLoadingBusy] = useState(true);
  const [err, setErr] = useState('');

  async function loadAreas() {
    setLoadingAreas(true);
    setErr('');
    const { data, error } = await supabase
      .from('areas')
      .select('id,name,sort')
      .order('sort', { ascending: true });

    if (error) {
      console.error('loadAreas error:', error);
      setErr(error.message);
      setAreas([]);
      setActiveArea(null);
    } else {
      setAreas(data || []);
      if (!activeArea && data?.length) setActiveArea(data[0].id);
    }
    setLoadingAreas(false);
  }

  async function loadTables(areaId) {
    if (!areaId) {
      setTables([]);
      return;
    }
    setLoadingTables(true);
    setErr('');
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id,name,status')
      .eq('area_id', areaId)
      .order('name', { ascending: true });

    if (error) {
      console.error('loadTables error:', error);
      setErr(error.message);
      setTables([]);
    } else {
      setTables(data || []);
    }
    setLoadingTables(false);
  }

  async function loadBusyTables() {
    setLoadingBusy(true);
    setErr('');
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id,name,status')
      .eq('status', 'in_use')
      .order('name', { ascending: true });

    if (error) {
      console.error('loadBusyTables error:', error);
      setErr(error.message);
      setBusyTables([]);
    } else {
      setBusyTables(data || []);
    }
    setLoadingBusy(false);
  }

  useEffect(() => {
    loadAreas();
    loadBusyTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTables(activeArea);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArea]);

  const areaName = useMemo(() => {
    const a = areas.find((x) => x.id === activeArea);
    return a?.name || '';
  }, [areas, activeArea]);

  return (
    <main style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>BQ Cafe POS</h3>
          <div style={{ fontSize: 12, color: '#666' }}>Chọn bàn để vào order</div>
        </div>

        {/* ✅ Nút phải nằm trong return JSX (đây là chỗ bạn bị đặt sai trước đó) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => router.push('/menu')}>Quản lý Menu</button>
          <button onClick={() => router.push('/areas')}>Khu &amp; Bàn</button>
          <button onClick={() => router.push('/history/today')}>Lịch sử hôm nay</button>
        </div>
      </div>

      {err && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: '#fff3f3',
            border: '1px solid #ffd6d6',
            color: '#b00020',
            fontSize: 13
          }}
        >
          Lỗi: {err}
        </div>
      )}

      {/* Busy tables block */}
      <div style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h4 style={{ margin: 0 }}>Bàn đang sử dụng</h4>
          <button onClick={loadBusyTables} disabled={loadingBusy}>
            {loadingBusy ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>

        {loadingBusy && <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>Đang tải...</div>}

        {!loadingBusy && busyTables.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>Không có bàn nào đang sử dụng.</div>
        )}

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {busyTables.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/table/${t.id}`)}
              style={{
                padding: '8px 10px',
                borderRadius: 999,
                border: '1px solid #ffd59a',
                background: '#fff7ed',
                cursor: 'pointer',
                fontWeight: 700
              }}
              title="Vào order"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Areas */}
      <div style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h4 style={{ margin: 0 }}>Khu</h4>
          <button onClick={loadAreas} disabled={loadingAreas}>
            {loadingAreas ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveArea(a.id)}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: activeArea === a.id ? '2px solid #1976d2' : '1px solid #ddd',
                background: activeArea === a.id ? '#e3f2fd' : '#fff',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              {a.name}
            </button>
          ))}
          {!loadingAreas && areas.length === 0 && (
            <div style={{ fontSize: 13, color: '#666' }}>Chưa có khu nào.</div>
          )}
        </div>
      </div>

      {/* Tables */}
      <div style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h4 style={{ margin: 0 }}>Bàn trong khu {areaName ? `(${areaName})` : ''}</h4>
          <button onClick={() => loadTables(activeArea)} disabled={loadingTables || !activeArea}>
            {loadingTables ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>

        {loadingTables && <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>Đang tải...</div>}

        {!loadingTables && tables.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>Không có bàn trong khu này.</div>
        )}

        <div
          style={{
            marginTop: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
            gap: 10
          }}
        >
          {tables.map((t) => {
            const isEmpty = t.status === 'empty';
            return (
              <button
                key={t.id}
                onClick={() => router.push(`/table/${t.id}`)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  background: isEmpty ? '#e8fff0' : '#fff3e0',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                title="Vào order"
              >
                <div style={{ fontWeight: 800 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{t.status}</div>
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
