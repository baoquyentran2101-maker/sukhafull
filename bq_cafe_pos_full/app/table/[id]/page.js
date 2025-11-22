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

  // ===== LOAD DATA =====

  async function loadTable() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', tableId)
      .single();
    if (error) {
      console.error('loadTable error:', error);
    }
    setTable(data);
  }

  async function loadGroupsAndItems() {
    const { data: g, error } = await supabase
      .from('menu_groups')
      .select('id, name, sort')
      .order('sort', { ascending: true });
    if (error) {
      console.error('loadGroups error:', error);
    }
    setGroups(g || []);
    if (g && g.length > 0 && !activeGroup) setActiveGroup(g[0].id);
  }

  async function loadItems(groupId) {
    if (!groupId) return;
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort', { ascending: true });
    if (error) {
      console.error('loadItems error:', error);
    }
    setItems(data || []);
  }

  async function loadOpenOrder() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('loadOpenOrder error:', error);
    }

    if (data && data.length > 0) {
      setOrder(data[0]);
      await loadOrderItems(data[0].id);
    } else {
      setOrder(null);
      setOrderItems([]);
    }
  }

  async function loadOrderItems(orderId) {
    const { data, error } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty, amount, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('loadOrderItems error:', error);
    }
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

  // ===== GOM NHÓM ĐƠN HÀNG / TÍNH TỔNG =====

  const groupedOrder = useMemo(() => {
    const map = new Map();
    for (const oi of orderItems) {
      const key = oi.item_name;
      const prev =
        map.get(key) || {
          name: key,
          qty: 0,
          total: 0,
          price: oi.price
        };
      const qty = Number(oi.qty || 0);
      const lineTotal =
        oi.amount != null
          ? Number(oi.amount)
          : Number(oi.price || 0) * qty;

      prev.qty += qty;
      prev.total += lineTotal;
      prev.price = oi.price;
      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [orderItems]);

  const orderTotal = useMemo(
    () => groupedOrder.reduce((sum, it) => sum + it.total, 0),
    [groupedOrder]
  );

  // Tìm 1 dòng order_items theo (tên + giá) trong state hiện tại
  function findOneOrderItem(name, price) {
    const matches = orderItems.filter(
      (oi) =>
        oi.item_name === name &&
        Number(oi.price || 0) === Number(price || 0)
    );
    if (matches.length === 0) return null;
    // lấy dòng mới nhất (created_at lớn nhất)
    return matches[matches.length - 1];
  }

  // ===== LOGIC ORDER =====

  async function ensureOrder() {
    if (order) return order;
    const tableName = table?.name || '';

    const { data, error } = await supabase
      .from('orders')
      .insert({ table_id: tableId, table_name: tableName, status: 'open' })
      .select('*')
      .single();

    if (error) {
      console.error('ensureOrder error:', error);
      return null;
    }

    setOrder(data);
    await supabase
      .from('cafe_tables')
      .update({ status: 'in_use' })
      .eq('id', tableId);
    return data;
  }

  // === THÊM MÓN (giữ nguyên logic gốc của bạn) ===
  async function addItemToOrder(item) {
    const currentOrder = await ensureOrder();
    if (!currentOrder) return;

    const { error } = await supabase.from('order_items').insert({
      order_id: currentOrder.id,
      item_name: item.name,
      price: item.price,
      qty: 1
    });

    if (error) {
      console.error('addItemToOrder error:', error);
      return;
    }

    await loadOrderItems(currentOrder.id);
  }

  // +1 số lượng cho 1 món (dùng lại addItemToOrder)
  async function handleIncrease(name, price) {
    // Tạo object giả giống item menu
    await addItemToOrder({ name, price });
  }

  // -1 số lượng cho 1 món; nếu về 0 thì xoá món
  async function handleDecrease(name, price) {
    if (!order) return;

    const target = findOneOrderItem(name, price);
    if (!target) return;

    const currentQty = Number(target.qty || 0) || 1;

    if (currentQty <= 1) {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', target.id);
      if (error) {
        console.error('handleDecrease delete error:', error);
      }
    } else {
      const { error } = await supabase
        .from('order_items')
        .update({ qty: currentQty - 1 })
        .eq('id', target.id);
      if (error) {
        console.error('handleDecrease update error:', error);
      }
    }

    await loadOrderItems(order.id);
  }

  // ===== THANH TOÁN =====

  async function handlePay() {
    if (!order || groupedOrder.length === 0 || orderTotal <= 0) return;
    setPaying(true);
    try {
      const { error: payError } = await supabase.from('payments').insert({
        order_id: order.id,
        method: payMethod,
        paid_amount: orderTotal
      });
      if (payError) {
        console.error('insert payment error:', payError);
        return;
      }

      const { error: orderErr } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order.id);
      if (orderErr) {
        console.error('update order paid error:', orderErr);
        return;
      }

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

  // ===== UI =====

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
              const grouped = groupedOrder.find(
                (go) =>
                  go.name === it.name &&
                  Number(go.price || 0) === Number(it.price || 0)
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

                  {/* Nếu chưa có -> + Thêm; nếu có -> - SL + */}
                  {!grouped ? (
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
                        onClick={() =>
                          handleDecrease(grouped.name, grouped.price)
                        }
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
                        {grouped.qty}
                      </span>
                      <button
                        onClick={() =>
                          handleIncrease(grouped.name, grouped.price)
                        }
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
          {groupedOrder.length === 0 && <div>Chưa có món nào.</div>}

          {groupedOrder.length > 0 && (
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
                {groupedOrder.map((it) => (
                  <tr key={`${it.name}-${it.price}`}>
                    <td style={{ padding: '4px 0' }}>{it.name}</td>
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
                          onClick={() =>
                            handleDecrease(it.name, it.price)
                          }
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
                          {it.qty}
                        </span>
                        <button
                          onClick={() =>
                            handleIncrease(it.name, it.price)
                          }
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
                      {it.total.toLocaleString('vi-VN')} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Tổng & thanh toán */}
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
                disabled={paying || !order || groupedOrder.length === 0}
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
