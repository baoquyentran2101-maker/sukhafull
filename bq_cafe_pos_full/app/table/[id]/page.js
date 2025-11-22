'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function TablePage({ params }) {
  const tableId = params.id;
  const router = useRouter();

  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');

  // ================== LOAD DATA ==================

  async function loadTable() {
    const { data } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', tableId)
      .single();
    setTable(data);
  }

  async function loadGroupsAndItems() {
    const { data: g } = await supabase
      .from('menu_groups')
      .select('id, name, sort')
      .order('sort', { ascending: true });
    setGroups(g || []);
    if (g && g.length > 0 && !activeGroup) setActiveGroup(g[0].id);
  }

  async function loadItems(groupId) {
    if (!groupId) return;
    const { data } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort', { ascending: true });
    setItems(data || []);
  }

  async function loadOpenOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setOrder(data[0]);
      await loadOrderItems(data[0].id);
    } else {
      setOrder(null);
      setOrderItems([]);
    }
  }

  async function loadOrderItems(orderId) {
    const { data } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty, amount')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setOrderItems(data || []);
  }

  useEffect(() => {
    loadTable();
    loadGroupsAndItems();
    loadOpenOrder();
  }, [tableId]);

  useEffect(() => {
    if (activeGroup) loadItems(activeGroup);
  }, [activeGroup]);

  // ================== TÍNH TOÁN ==================

  const orderTotal = useMemo(
    () =>
      orderItems.reduce((sum, it) => {
        const qty = Number(it.qty || 0);
        const price = Number(it.price || 0);
        const lineTotal =
          it.amount != null ? Number(it.amount) : qty * price;
        return sum + lineTotal;
      }, 0),
    [orderItems]
  );

  // Tìm 1 dòng order_items theo item_name + price
  function findOrderItemByNameAndPrice(name, price) {
    return orderItems.find(
      (oi) =>
        oi.item_name === name &&
        Number(oi.price || 0) === Number(price || 0)
    );
  }

  // ================== LOGIC ĐƠN HÀNG ==================

  async function ensureOrder() {
    if (order) return order;

    const tableName = table?.name || '';
    const { data, error } = await supabase
      .from('orders')
      .insert({ table_id: tableId, table_name: tableName, status: 'open' })
      .select('*')
      .single();

    if (!error) {
      setOrder(data);
      await supabase
        .from('cafe_tables')
        .update({ status: 'in_use' })
        .eq('id', tableId);
      return data;
    }
    return null;
  }

  // Thêm món từ menu:
  // - Nếu chưa có -> INSERT qty = 1
  // - Nếu đã có   -> UPDATE qty + 1
  async function addItemToOrder(item) {
    const currentOrder = await ensureOrder();
    if (!currentOrder) return;

    const existing = findOrderItemByNameAndPrice(item.name, item.price);
    const price = Number(item.price || 0);

    if (!existing) {
      await supabase.from('order_items').insert({
        order_id: currentOrder.id,
        item_name: item.name,
        price: price,
        qty: 1,
        amount: price
      });
    } else {
      const currentQty = Number(existing.qty || 0);
      const newQty = currentQty + 1;
      const newAmount = newQty * price;

      await supabase
        .from('order_items')
        .update({ qty: newQty, amount: newAmount })
        .eq('id', existing.id);
    }

    await loadOrderItems(currentOrder.id);
  }

  // +1 số lượng (theo id dòng order_items)
  async function increaseOrderItem(oi) {
    if (!order) return;
    const price = Number(oi.price || 0);
    const currentQty = Number(oi.qty || 0);
    const newQty = currentQty + 1;
    const newAmount = newQty * price;

    await supabase
      .from('order_items')
      .update({ qty: newQty, amount: newAmount })
      .eq('id', oi.id);

    await loadOrderItems(order.id);
  }

  // -1 số lượng, nếu về 0 thì xoá món luôn
  async function decreaseOrderItem(oi) {
    if (!order) return;
    const price = Number(oi.price || 0);
    const currentQty = Number(oi.qty || 0);

    if (currentQty <= 1) {
      await supabase.from('order_items').delete().eq('id', oi.id);
    } else {
      const newQty = currentQty - 1;
      const newAmount = newQty * price;
      await supabase
        .from('order_items')
        .update({ qty: newQty, amount: newAmount })
        .eq('id', oi.id);
    }

    await loadOrderItems(order.id);
  }

  // ================== THANH TOÁN ==================

  async function handlePay() {
    if (!order || orderItems.length === 0 || orderTotal <= 0) return;
    setPaying(true);
    try {
      await supabase.from('payments').insert({
        order_id: order.id,
        method: payMethod,
        paid_amount: orderTotal
      });
      await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);
      await supabase
        .from('cafe_tables')
        .update({ status: 'empty' })
        .eq('id', tableId);

      setOrder(null);
      setOrderItems([]);
      router.push('/history/today');
    } finally {
      setPaying(false);
    }
  }

  // ================== UI ==================

  return (
    <main style={{ padding: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Bàn {table?.name || ''}</h3>
          <small>{table?.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}</small>
        </div>
        <button onClick={() => router.push('/')}>Về chọn bàn</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Cột trái: Chọn món */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid #eee',
            paddingRight: 8
          }}
        >
          <h4>Chọn món</h4>

          {/* Nhóm món */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 8
            }}
          >
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  border:
                    activeGroup === g.id ? '2px solid #1976d2' : '1px solid #ccc',
                  background: activeGroup === g.id ? '#e3f2fd' : '#fff',
                  cursor: 'pointer'
                }}
              >
                {g.name}
              </button>
            ))}
          </div>

          {/* Danh sách món */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 8
            }}
          >
            {items.map((it) => {
              const existing = findOrderItemByNameAndPrice(
                it.name,
                it.price
              );

              return (
                <div
                  key={it.id}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 8,
                    border: '1px solid #ddd',
                    background: '#fafafa',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.name}</div>
                    <div style={{ fontSize: 12 }}>
                      {Number(it.price || 0).toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  {/* Nếu chưa có trong order: nút + Thêm, nếu có: - SL + */}
                  {!existing ? (
                    <button
                      onClick={() => addItemToOrder(it)}
                      style={{
                        marginTop: 4,
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#1976d2',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer'
                      }}
                    >
                      + Thêm
                    </button>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4
                      }}
                    >
                      <button
                        onClick={() => decreaseOrderItem(existing)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '1px solid #1976d2',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        -
                      </button>
                      <span
                        style={{
                          minWidth: 20,
                          textAlign: 'center',
                          fontSize: 13
                        }}
                      >
                        {existing.qty}
                      </span>
                      <button
                        onClick={() => increaseOrderItem(existing)}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: '1px solid #1976d2',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {items.length === 0 && <div>Không có món trong nhóm này.</div>}
          </div>
        </div>

        {/* Cột phải: Đơn hiện tại */}
        <div style={{ flex: 1 }}>
          <h4>Đơn hiện tại</h4>
          {orderItems.length === 0 && <div>Chưa có món nào.</div>}

          {orderItems.length > 0 && (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: 8
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #eee',
                      paddingBottom: 4
                    }}
                  >
                    Món
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      borderBottom: '1px solid #eee',
                      paddingBottom: 4
                    }}
                  >
                    SL
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      borderBottom: '1px solid #eee',
                      paddingBottom: 4
                    }}
                  >
                    Tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((oi) => {
                  const qty = Number(oi.qty || 0);
                  const price = Number(oi.price || 0);
                  const lineTotal =
                    oi.amount != null ? Number(oi.amount) : qty * price;

                  return (
                    <tr key={oi.id}>
                      <td style={{ padding: '4px 0' }}>{oi.item_name}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <button
                            onClick={() => decreaseOrderItem(oi)}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: '1px solid #1976d2',
                              background: '#fff',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            -
                          </button>
                          <span
                            style={{
                              minWidth: 20,
                              textAlign: 'center',
                              fontSize: 13
                            }}
                          >
                            {oi.qty}
                          </span>
                          <button
                            onClick={() => increaseOrderItem(oi)}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: '1px solid #1976d2',
                              background: '#fff',
                              cursor: 'pointer',
                              fontSize: 12
                            }}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', padding
