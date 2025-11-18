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

  // ===== LOAD DATA =====
  async function loadGroups() {
    const { data, error } = await supabase
      .from('menu_groups')
      .select('id, name, sort')
      .order('sort', { ascending: true });

    if (error) {
      console.error('Load groups error', error);
      return;
    }

    setGroups(data || []);
    if (!activeGroup && data && data.length > 0) {
      setActiveGroup(data[0].id);
    }
  }

  async function loadItems(groupId) {
    if (!groupId) return;
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price, is_active')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort', { ascending: true });

    if (error) {
      console.error('Load items error', error);
      return;
    }

    setItems(data || []);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (activeGroup) loadItems(activeGroup);
  }, [activeGroup]);

  // ===== THÊM NHÓM / MÓN =====
  async function addGroup(e) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    const { error } = await supabase.from('menu_groups').insert({ name });
    if (error) {
      alert('Không thêm được nhóm: ' + error.message);
      return;
    }

    setNewGroupName('');
    await loadGroups();
  }

  async function addItem(e) {
    e.preventDefault();
    if (!activeGroup) {
      alert('Hãy chọn nhóm món trước khi thêm.');
      return;
    }

    const name = newItemName.trim();
    const priceNumber = Number(newItemPrice || 0);

    if (!name) return;

    const { error } = await supabase.from('menu_items').insert({
      group_id: activeGroup,
      name,
      price: priceNumber,
    });

    if (error) {
      alert('Không thêm được món: ' + error.message);
      return;
    }

    setNewItemName('');
    setNewItemPrice('');
    await loadItems(activeGroup);
  }

  // ===== XOÁ NHÓM / MÓN =====
  async function deleteItem(id, name) {
    const ok = window.confirm(`Bạn có chắc muốn xoá món "${name}"?`);
    if (!ok) return;

    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) {
      alert('Không xoá được món: ' + error.message);
      return;
    }

    await loadItems(activeGroup);
  }

  async function deleteGroup(id, name) {
    const ok = window.confirm(
      `Xoá nhóm "${name}"? Tất cả món trong nhóm này cũng sẽ bị xoá.`
    );
    if (!ok) return;

    const { error } = await supabase.from('menu_groups').delete().eq('id', id);
    if (error) {
      alert('Không xoá được nhóm: ' + error.message);
      return;
    }

    // reload lại danh sách nhóm
    await loadGroups();

    // nếu đang đứng ở nhóm vừa xoá thì chọn nhóm khác (nếu còn)
    if (activeGroup === id) {
      setActiveGroup((prev) => {
        const remaining = groups.filter((g) => g.id !== id);
        return remaining.length > 0 ? remaining[0].id : null;
      });
      setItems([]);
    }
  }

  // ===== UI =====
  return (
    <main style={{ padding: 16 }}>
  <main style={{ padding: 16 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
    <h3 style={{ margin: 0 }}>Quản lý menu</h3>

    <button
      onClick={() => window.location.href = '/'}
      style={{
        padding: '6px 12px',
        background: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer'
      }}
    >
      ← Quay về chọn bàn
    </button>
  </div>


      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* CỘT NHÓM MÓN */}
        <div style={{ flex: 1 }}>
          <h4>Nhóm món</h4>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {groups.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 999,
                  border:
                    activeGroup === g.id ? '2px solid #1976d2' : '1px solid #ccc',
                  background: activeGroup === g.id ? '#e3f2fd' : '#fff',
                  padding: '2px 4px',
                }}
              >
                <button
                  onClick={() => setActiveGroup(g.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px 8px',
                    cursor: 'pointer',
                  }}
                >
                  {g.name}
                </button>
                <button
                  onClick={() => deleteGroup(g.id, g.name)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#d32f2f',
                    cursor: 'pointer',
                    padding: '0 6px',
                    fontSize: 12,
                  }}
                  title="Xoá nhóm"
                >
                  ✕
                </button>
              </div>
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

        {/* CỘT MÓN TRONG NHÓM */}
        <div style={{ flex: 1 }}>
          <h4>Món trong nhóm</h4>

          <div style={{ marginBottom: 8, maxHeight: 320, overflowY: 'auto' }}>
            {items.map((i) => (
              <div
                key={i.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderBottom: '1px solid #eee',
                }}
              >
                <div>
                  <div>{i.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {Number(i.price || 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <button
                  onClick={() => deleteItem(i.id, i.name)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#d32f2f',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                  title="Xoá món"
                >
                  Xoá
                </button>
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

          <small>Giá &amp; số lượng sẽ được chọn khi order tại màn hình bàn.</small>
        </div>
      </div>
    </main>
  );
}
