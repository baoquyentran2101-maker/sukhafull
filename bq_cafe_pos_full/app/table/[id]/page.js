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

  const orderTotal = useMemo(
    () =>
      orderItems.reduce((sum, it) => {
        const lineTotal =
          it.amount != null
            ? Number(it.amount)
            : Number(it.price || 0) * Number(it.qty || 0);
        return sum + lineTotal;
      }, 0),
    [orderItems]
  );

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

  // Thêm món hoặc +1 nếu đã có trong order
  async function addItemToOrder(item) {
    const currentOrder = await ensureOrder();
    if (!currentOrder) return;

    // Tìm món đã có trong order theo tên + giá
    const existing = orderItems.find(
      (oi) =>
        oi.item_name === item.name &&
        Number(oi.price || 0) === Number(item.price || 0)
    );

    if (existing) {
      const newQty = Number(existing.qty || 0) + 1;
      const newAmount = newQty * Number(existing.price || 0);
      await supabase
        .from('order_items')
        .update({ qty: newQty, amount: newAmount })
        .eq('id', existing.id);
    } else {
      await supabase.from('order_items').insert({
        order_id: currentOrder.id,
        item_name: item.name,
        price: item.price,
        qty: 1,
        amount: Number(item.price || 0)
      });
    }

    await loadOrderItems(currentOrder.id);
  }

  // +1 ở phần Đơn hiện tại
  async function increaseOrderItem(oi) {
    if (!order) return;
    const newQty = Number(oi.qty || 0) + 1;
    const newAmount = newQty * Number(oi.price || 0);
    await supabase
      .from('order_items')
      .update({ qty: newQty, amount: newAmount })
      .eq('id', oi.id);
    await loadOrderItems(order.id);
  }

  // -1 ở phần Đơn hiện tại (về 0 thì xoá dòng)
  async function decreaseOrderItem(oi) {
    if (!order) return;
    const currentQty = Number(oi.qty || 0);
    if (currentQty <= 1) {
      await supabase.from('order_items').delete().eq('id', oi.id);
    } else {
      const newQty = currentQty - 1;
      const newAmount = newQty * Number(oi.price || 0);
      await supabase
        .from('order_items')
        .update({ qty: newQty, amount: newAmount })
        .eq('id', oi.id);
    }
    await loadOrderItems(order.id);
  }

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

  return (
    <main style={{ padding: 16 }}>
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
        {/* Cột trái: chọn món */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid #eee',
            paddingRight: 8
          }}
        >
          <h4>Chọn món</h4>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 8
            }}
          >
            {items.map((it) => {
              const existing = orderItems.find(
                (oi) =>
                  oi.item_name === it.name &&
                  Number(oi.price || 0) === Number(it.price || 0)
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
                      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>
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

        {/* Cột phải: đơn hiện tại */}
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
                      textAlign: 'right',
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
                  const lineTotal =
                    oi.amount != null
                      ? Number(oi.amount)
                      : Number(oi.price || 0) * Number(oi.qty || 0);

                  return (
                    <tr key={oi.id}>
                      <td style={{ padding: '4px 0' }}>{oi.item_name}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
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
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>
                        {lineTotal.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8
            }}
          >
            <div>
              <strong>Tổng: {orderTotal.toLocaleString('vi-VN')} đ</strong>
            </div>
            <div>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                style={{ marginRight: 8 }}
              >
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
              </select>
              <button
                disabled={paying || !order || orderItems.length === 0}
                onClick={handlePay}
              >
                {paying ? 'Đang thanh toán...' : 'Thanh toán'}
              </button>
            </div>
          </div>
          <small>Thanh toán xong sẽ lưu bill vào &quot;Lịch sử hôm nay&quot;.</small>
        </div>
      </div>
    </main>
  );
}
