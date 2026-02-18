'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

export default function MenuManagerPage() {
  // ===== data =====
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [items, setItems] = useState([]);

  // ===== add forms =====
  const [newGroupName, setNewGroupName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // ===== edit states =====
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [editingItemPrice, setEditingItemPrice] = useState('');

  // ===== ui =====
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || null,
    [groups, activeGroupId]
  );

  // ---------- loaders ----------
  async function loadGroups() {
    const { data, error } = await supabase
      .from('menu_groups')
      .select('id, name, sort, created_at')
      .order('sort', { ascending: true });

    if (error) throw error;

    setGroups(data || []);
    if (!activeGroupId && data?.length) setActiveGroupId(data[0].id);
  }

  async function loadItems(groupId) {
    if (!groupId) {
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('id, group_id, name, price, sort, is_active, created_at')
      .eq('group_id', groupId)
      .order('sort', { ascending: true });

    if (error) throw error;
    setItems(data || []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErrMsg('');
        await loadGroups();
      } catch (e) {
        console.error('loadGroups error:', e);
        if (alive) setErrMsg('Không tải được menu_groups.');
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
        setErrMsg('');
        await loadItems(activeGroupId);
      } catch (e) {
        console.error('loadItems error:', e);
        if (alive) setErrMsg('Không tải được menu_items.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeGroupId]);

  // ---------- actions: groups ----------
  async function addGroup(e) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name) return;

    setSaving(true);
    setErrMsg('');
    try {
      const sort = (groups?.[groups.length - 1]?.sort ?? groups.length) + 1;

      const { error } = await supabase.from('menu_groups').insert({
        name,
        sort
      });
      if (error) throw error;

      setNewGroupName('');
      await loadGroups();
    } catch (e2) {
      console.error('addGroup error:', e2);
      setErrMsg('Không thêm được nhóm. Kiểm tra quyền RLS / policy.');
    } finally {
      setSaving(false);
    }
  }

  function startEditGroup(g) {
    setEditingGroupId(g.id);
    setEditingGroupName(g.name || '');
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setEditingGroupName('');
  }

  async function saveEditGroup() {
    const name = editingGroupName.trim();
    if (!editingGroupId || !name) return;

    setSaving(true);
    setErrMsg('');
    try {
      const { error } = await supabase
        .from('menu_groups')
        .update({ name })
        .eq('id', editingGroupId);

      if (error) throw error;

      await loadGroups();
      cancelEditGroup();
    } catch (e) {
      console.error('saveEditGroup error:', e);
      setErrMsg('Không cập nhật được tên nhóm.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup(groupId) {
    if (!groupId) return;
    const ok = confirm('Xoá nhóm này? (Món trong nhóm sẽ bị xoá theo)');
    if (!ok) return;

    setSaving(true);
    setErrMsg('');
    try {
      const { error } = await supabase.from('menu_groups').delete().eq('id', groupId);
      if (error) throw error;

      // reset selection if needed
      const nextGroups = groups.filter((g) => g.id !== groupId);
      setGroups(nextGroups);

      const nextActive = nextGroups[0]?.id || null;
      setActiveGroupId(nextActive);
      if (nextActive) await loadItems(nextActive);
      else setItems([]);

      cancelEditGroup();
    } catch (e) {
      console.error('deleteGroup error:', e);
      setErrMsg('Không xoá được nhóm.');
    } finally {
      setSaving(false);
    }
  }

  // ---------- actions: items ----------
  async function addItem(e) {
    e.preventDefault();
    const name = newItemName.trim();
    const price = Number(newItemPrice || 0);

    if (!activeGroupId) {
      setErrMsg('Hãy chọn nhóm trước khi thêm món.');
      return;
    }
    if (!name) return;

    setSaving(true);
    setErrMsg('');
    try {
      const sort = (items?.[items.length - 1]?.sort ?? items.length) + 1;

      const { error } = await supabase.from('menu_items').insert({
        group_id: activeGroupId,
        name,
        price,
        sort,
        is_active: true
      });
      if (error) throw error;

      setNewItemName('');
      setNewItemPrice('');
      await loadItems(activeGroupId);
    } catch (e) {
      console.error('addItem error:', e);
      setErrMsg('Không thêm được món.');
    } finally {
      setSaving(false);
    }
  }

  function startEditItem(it) {
    setEditingItemId(it.id);
    setEditingItemName(it.name || '');
    setEditingItemPrice(String(Number(it.price || 0)));
  }

  function cancelEditItem() {
    setEditingItemId(null);
    setEditingItemName('');
    setEditingItemPrice('');
  }

  async function saveEditItem() {
    if (!editingItemId) return;

    const name = editingItemName.trim();
    const price = Number(editingItemPrice || 0);
    if (!name) return;

    setSaving(true);
    setErrMsg('');
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ name, price })
        .eq('id', editingItemId);

      if (error) throw error;

      await loadItems(activeGroupId);
      cancelEditItem();
    } catch (e) {
      console.error('saveEditItem error:', e);
      setErrMsg('Không cập nhật được món.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleItemActive(it) {
    setSaving(true);
    setErrMsg('');
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_active: !it.is_active })
        .eq('id', it.id);
      if (error) throw error;

      await loadItems(activeGroupId);
    } catch (e) {
      console.error('toggleItemActive error:', e);
      setErrMsg('Không bật/tắt được món.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(itemId) {
    const ok = confirm('Xoá món này?');
    if (!ok) return;

    setSaving(true);
    setErrMsg('');
    try {
      const { error } = await supabase.from('menu_items').delete().eq('id', itemId);
      if (error) throw error;

      await loadItems(activeGroupId);
      if (editingItemId === itemId) cancelEditItem();
    } catch (e) {
      console.error('deleteItem error:', e);
      setErrMsg('Không xoá được món.');
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI ----------
  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Quản lý Menu</h3>
        <div style={{ fontSize: 12, color: '#666' }}>{saving ? 'Đang lưu...' : ''}</div>
      </div>

      {errMsg && <div style={{ marginTop: 10, color: '#b00020' }}>{errMsg}</div>}

      {loading ? (
        <div style={{ marginTop: 12 }}>Đang tải...</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'flex-start' }}>
          {/* LEFT: groups */}
          <div style={{ width: 340, border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>Nhóm món</h4>
              <button onClick={loadGroups} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>
                Tải lại
              </button>
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groups.map((g) => {
                const active = g.id === activeGroupId;
                const editing = g.id === editingGroupId;

                return (
                  <div
                    key={g.id}
                    style={{
                      border: active ? '2px solid #1976d2' : '1px solid #eee',
                      borderRadius: 10,
                      padding: 10,
                      background: active ? '#e3f2fd' : '#fff'
                    }}
                  >
                    {!editing ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <button
                          onClick={() => setActiveGroupId(g.id)}
                          style={{
                            flex: 1,
                            textAlign: 'left',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            fontWeight: 800
                          }}
                        >
                          {g.name}
                        </button>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => startEditGroup(g)}
                            style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => deleteGroup(g.id)}
                            style={{ border: '1px solid #f3c2c2', borderRadius: 8, padding: '6px 10px' }}
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                          placeholder="Tên nhóm..."
                        />
                        <button
                          onClick={saveEditGroup}
                          disabled={saving || !editingGroupName.trim()}
                          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontWeight: 800 }}
                        >
                          Lưu
                        </button>
                        <button
                          onClick={cancelEditGroup}
                          disabled={saving}
                          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px' }}
                        >
                          Huỷ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {groups.length === 0 && <div style={{ color: '#666' }}>Chưa có nhóm nào.</div>}
            </div>

            <form onSubmit={addGroup} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Tên nhóm mới..."
                style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
              />
              <button
                type="submit"
                disabled={saving || !newGroupName.trim()}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontWeight: 800 }}
              >
                Thêm
              </button>
            </form>
          </div>

          {/* RIGHT: items */}
          <div style={{ flex: 1, border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>
                Món trong nhóm: <span style={{ color: '#1976d2' }}>{activeGroup?.name || '-'}</span>
              </h4>
              <button onClick={() => loadItems(activeGroupId)} style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}>
                Tải lại
              </button>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {items.map((it) => {
                const editing = it.id === editingItemId;
                return (
                  <div
                    key={it.id}
                    style={{
                      border: '1px solid #eee',
                      borderRadius: 10,
                      padding: 10,
                      background: it.is_active ? '#fff' : '#fafafa'
                    }}
                  >
                    {!editing ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 900 }}>
                            {it.name}{' '}
                            {!it.is_active && <span style={{ fontSize: 12, color: '#999' }}>(đang tắt)</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#666' }}>{fmtVND(it.price)}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => toggleItemActive(it)}
                            disabled={saving}
                            style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}
                          >
                            {it.is_active ? 'Tắt' : 'Bật'}
                          </button>
                          <button
                            onClick={() => startEditItem(it)}
                            disabled={saving}
                            style={{ border: '1px solid #ddd', borderRadius: 8, padding: '6px 10px' }}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => deleteItem(it.id)}
                            disabled={saving}
                            style={{ border: '1px solid #f3c2c2', borderRadius: 8, padding: '6px 10px' }}
                          >
                            Xoá
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          value={editingItemName}
                          onChange={(e) => setEditingItemName(e.target.value)}
                          style={{ flex: 1, minWidth: 220, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                          placeholder="Tên món..."
                        />
                        <input
                          type="number"
                          value={editingItemPrice}
                          onChange={(e) => setEditingItemPrice(e.target.value)}
                          style={{ width: 140, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                          placeholder="Giá..."
                        />
                        <button
                          onClick={saveEditItem}
                          disabled={saving || !editingItemName.trim()}
                          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontWeight: 900 }}
                        >
                          Lưu
                        </button>
                        <button
                          onClick={cancelEditItem}
                          disabled={saving}
                          style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px' }}
                        >
                          Huỷ
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {items.length === 0 && <div style={{ color: '#666' }}>Chưa có món trong nhóm này.</div>}
            </div>

            <form
              onSubmit={addItem}
              style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
            >
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Tên món..."
                style={{ flex: 1, minWidth: 260, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                disabled={!activeGroupId}
              />
              <input
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Giá..."
                style={{ width: 160, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                disabled={!activeGroupId}
              />
              <button
                type="submit"
                disabled={saving || !activeGroupId || !newItemName.trim()}
                style={{ border: '1px solid #ddd', borderRadius: 8, padding: '8px 12px', fontWeight: 900 }}
              >
                Thêm món
              </button>
            </form>

            {!activeGroupId && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                Hãy tạo/chọn nhóm trước khi thêm món.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
