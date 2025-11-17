'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AreasPage() {
  const [areas, setAreas] = useState([]);
  const [activeArea, setActiveArea] = useState(null);
  const [tables, setTables] = useState([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newTableName, setNewTableName] = useState('');

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

  useEffect(() => {
    loadAreas();
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
  }

  return (
    <main style={{ padding: 16 }}>
      <h3>Quản lý khu &amp; bàn</h3>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
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
                <div style={{ fontSize: 12 }}>{t.status}</div>
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
    </main>
  );
}
