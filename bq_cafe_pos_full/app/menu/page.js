'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MenuPage() {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  async function loadGroups() {
    const { data } = await supabase
      .from('menu_groups')
      .select('id, name, sort')
      .order('sort', { ascending: true });
    setGroups(data || []);
    if (!activeGroup && data && data.length > 0) setActiveGroup(data[0].id);
  }

  async function loadItems(groupId) {
    if (!groupId) return;
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, price, is_active')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort', { ascending: true });
    setItems(data || []);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (activeGroup) loadItems(activeGroup);
  }, [activeGroup]);

  async function addGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await supabase.from('menu_groups').insert({ name: newGroupName.trim() });
    setNewGroupName('');
    await loadGroups();
  }

  async function addItem(e) {
    e.preventDefault();
    if (!activeGroup || !newItemName.trim()) return;
    const price = Number(newItemPrice || 0);
    await supabase.from('menu_items').insert({
      group_id: activeGroup,
      name: newItemName.trim(),
      price
    });
    setNewItemName('');
    setNewItemPrice('');
    await loadItems(activeGroup);
  }

  return (
    <main style={{ padding: 16 }}>
      <h3>Quản lý menu</h3>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h4>Nhóm món</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: activeGroup === g.id ? '2px solid #1976d2' : '1px solid #ccc',
                  background: activeGroup === g.id ? '#e3f2fd' : '#fff',
                  cursor: 'pointer'
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
          <form onSubmit={addGroup} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Tên nhóm mới..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              style={{ flex: 1, padding: 6 }}
            />
            <button type="submit">Thêm nhóm</button>
          </form>
        </div>

        <div style={{ flex: 1 }}>
          <h4>Món trong nhóm</h4>
          <div style={{ marginBottom: 8 }}>
            {items.map((i) => (
              <div
                key={i.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderBottom: '1px solid #eee'
                }}
              >
                <span>{i.name}</span>
                <span>{Number(i.price || 0).toLocaleString('vi-VN')} đ</span>
              </div>
            ))}
            {items.length === 0 && <div>Chưa có món trong nhóm này.</div>}
          </div>
          <form onSubmit={addItem} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Tên món..."
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ flex: 2, padding: 6 }}
            />
            <input
              placeholder="Giá..."
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              style={{ flex: 1, padding: 6 }}
            />
            <button type="submit">Thêm món</button>
          </form>
          <small>Giá &quot;số lượng&quot; sẽ được chọn khi order tại màn hình bàn.</small>
        </div>
      </div>
    </main>
  );
}
