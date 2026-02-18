'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MenuManager() {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [items, setItems] = useState([]);

  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // LOAD GROUPS
  async function loadGroups() {
    const { data } = await supabase
      .from('menu_groups')
      .select('*')
      .order('sort', { ascending: true });

    setGroups(data || []);
    if (!activeGroup && data?.length) setActiveGroup(data[0].id);
  }

  // LOAD ITEMS
  async function loadItems(groupId) {
    if (!groupId) return;
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('group_id', groupId)
      .order('sort', { ascending: true });

    setItems(data || []);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    loadItems(activeGroup);
  }, [activeGroup]);

  // ADD GROUP
  async function addGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    await supabase.from('menu_groups').insert({
      name: newGroupName,
      sort: groups.length + 1
    });

    setNewGroupName('');
    loadGroups();
  }

  // ADD ITEM
  async function addItem(e) {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;

    await supabase.from('menu_items').insert({
      group_id: activeGroup,
      name: newItemName,
      price: Number(newItemPrice),
      sort: items.length + 1,
      is_active: true
    });

    setNewItemName('');
    setNewItemPrice('');
    loadItems(activeGroup);
  }

  async function toggleItem(id, current) {
    await supabase
      .from('menu_items')
      .update({ is_active: !current })
      .eq('id', id);

    loadItems(activeGroup);
  }

  return (
    <main style={{ padding: 20 }}>
      <h3>Quản lý Menu</h3>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* GROUPS */}
        <div style={{ width: 300 }}>
          <h4>Nhóm món</h4>

          {groups.map((g) => (
            <div key={g.id}>
              <button
                onClick={() => setActiveGroup(g.id)}
                style={{
                  marginBottom: 5,
                  fontWeight: activeGroup === g.id ? 700 : 400
                }}
              >
                {g.name}
              </button>
            </div>
          ))}

          <form onSubmit={addGroup} style={{ marginTop: 10 }}>
            <input
              placeholder="Tên nhóm mới"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <button type="submit">Thêm nhóm</button>
          </form>
        </div>

        {/* ITEMS */}
        <div style={{ flex: 1 }}>
          <h4>Món trong nhóm</h4>

          {items.map((it) => (
            <div
              key={it.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #eee',
                padding: 5
              }}
            >
              <div>
                {it.name} — {Number(it.price).toLocaleString('vi-VN')} đ
              </div>

              <button onClick={() => toggleItem(it.id, it.is_active)}>
                {it.is_active ? 'Tắt' : 'Bật'}
              </button>
            </div>
          ))}

          <form onSubmit={addItem} style={{ marginTop: 10 }}>
            <input
              placeholder="Tên món"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
            <input
              type="number"
              placeholder="Giá"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              style={{ width: 100, marginLeft: 5 }}
            />
            <button type="submit">Thêm món</button>
          </form>
        </div>
      </div>
    </main>
  );
}
