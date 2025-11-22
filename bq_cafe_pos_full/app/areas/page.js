'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';  // ✅ thêm router

export default function AreasPage() {
  const router = useRouter(); // ✅ hook điều hướng

  const [areas, setAreas] = useState([]);
  const [activeArea, setActiveArea] = useState(null);
  const [tables, setTables] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [usingTables, setUsingTables] = useState([]); // tất cả bàn đang sử dụng

  async function loadAreas() {
    const { data } = await supabase
      .from('areas')
      .select('id, name, sort')
      .order('sort', { ascending: true });
    setAreas(data || []);
    if (!activeArea && data && data.length > 0) setActiveArea(data[0].id);
  }

  async function loadTables(areaId) {
    if (!areaId) return;
    const { data } = await supabase
      .from('cafe_tables')
      .select('id, name, status')
      .eq('area_id', areaId)
      .order('name', { ascending: true });

    setTables(data || []);
  }

  // Load tất cả bàn đang sử dụng (không phân khu)
  async function loadUsingTables() {
    const { data } = await supabase
      .from('cafe_tables')
      .select('id, name, status')
      .eq('status', 'in_use')
      .order('name', { ascending: true });

    setUsingTables(data || []);
  }

  useEffect(() => {
    loadAreas();
    loadUsingTables();
  }, []);

  useEffect(() => {
    if (activeArea) loadTables(activeArea);
  }, [activeArea]);

  async function addArea(e) {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    await supabase.from('areas').insert({ name: newAreaName.trim() });
    setNewAreaName('');
    await loadAreas();
  }

  async function addTable(e) {
    e.preventDefault();
    if (!activeArea || !newTableName.trim()) return;
    await supabase.from('cafe_tables').insert({
      area_id: activeArea,
      name: newTableName.trim(),
      status: 'empty'
    });
    setNewTableName('');
    await loadTables(activeArea);
    await loadUsingTables();
  }

  return (
    <main style={{ padding: 16 }}>
      <h3>Quản lý khu &amp; bàn</h3>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* KHU */}
        <div style={{ flex: 1 }}>
          <h4>Khu</h4>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
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

          <form onSubmit={addArea} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Tên khu mới..."
              value={newAreaName}
              onChange={(e) => setNewAreaName(e.target.value)}
              style={{ flex: 1, padding: 6 }}
            />
            <button type="submit">Thêm khu</button>
          </form>
        </div>

        {/* BÀN TRONG KHU */}
        <div style={{ flex: 1 }}>
          <h4>Bàn trong khu</h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 8,
              marginBottom: 8
            }}
          >
            {tables.map((t) => (
              <div
                key={t.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 6,
                  textAlign: 'center',
                  background: t.status === 'empty' ? '#e8fff0' : '#fff3e0'
                }}
              >
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12 }}>
                  {t.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={addTable} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Tên bàn mới..."
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              style={{ flex: 1, padding: 6 }}
            />
            <button type="submit">Thêm bàn</button>
          </form>
        </div>
      </div>

      {/* ============================
          BLOCK RIÊNG: BÀN ĐANG SỬ DỤNG
          ============================ */}
      <div style={{ marginTop: 28 }}>
        <h4>Tất cả bàn đang sử dụng</h4>

        {usingTables.length === 0 ? (
          <div style={{ fontSize: 13, color: '#777' }}>
            Hiện chưa có bàn nào đang sử dụng.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
            {usingTables.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/table/${t.id}`)} // ✅ CLICK → NHẢY TỚI ORDER
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: '#fff3e0',
                  border: '1px solid #ffb74d',
                  fontSize: 14,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
