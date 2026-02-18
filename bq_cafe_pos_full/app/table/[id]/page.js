'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

export default function TablePage({ params }) {
  const tableId = params?.id;
  const router = useRouter();

  // ===== DATA =====
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);

  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  // ===== POS =====
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [servicePercent, setServicePercent] = useState(5);
  const [servicePercentBackup, setServicePercentBackup] = useState(5);

  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);

  // ===== UI =====
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // ---------- LOADERS ----------
  async function loadTable() {
    const { data, error } = await supabase.from('cafe_tables').select('*').eq('id', tableId).single();
    if (error) throw error;
    setTable(data || null);
    return data;
  }

  async function loadGroups() {
    const { data, error } = await supabase
      .from('menu_groups')
      .select('id, name, sort')
      .order('sort', { ascending: true });

    if (error) throw error;
    setGroups(data || []);
    if (!activeGroup && data?.length) setActiveGroup(data[0].id);
  }

  async function loadItems(groupId) {
    if (!groupId) return;
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, name, price, sort')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort', { ascending: true });

    if (error) throw error;
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

    if (error) throw error;

    if (data?.length) {
      setOrder(data[0]);
      await loadOrderItems(data[0].id);
      return data[0];
    }

    setOrder(null);
    setOrderItems([]);
    return null;
  }

  async function loadOrderItems(orderId) {
    if (!orderId) return;
    const { data, error } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    setOrderItems(data || []);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!tableId) return;
        setLoading(true);
        setErrMsg('');

        await Promise.all([loadTable(), loadGroups()]);
        await loadOpenOrder();
      } catch (e) {
        console.error('TablePage load error:', e);
        if (!alive) return;
        setErrMsg('Không tải được dữ liệu. Vui lòng kiểm tra Supabase / bảng dữ liệu.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!activeGroup) return;
        await loadItems(activeGroup);
      } catch (e) {
        console.error('loadItems error:', e);
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeGroup]);

  // ---------- ORDER HELPERS ----------
  async function ensureOrderOpen() {
    if (order?.id) return order;

    const tableName = table?.name || '';
    const { data, error } = await supabase
      .from('orders')
      .insert({ table_id: tableId, table_name: tableName, status: 'open' })
      .select('*')
      .single();

    if (error) throw error;

    setOrder(data);
    await supabase.from('cafe_tables').update({ status: 'in_use' }).eq('id', tableId);

    return data;
  }

  function findOrderLine(name, price) {
    return orderItems.find(
      (x) => x.item_name === name && Number(x.price || 0) === Number(price || 0)
    );
  }

  // chuẩn POS: 1 món = 1 dòng, update qty; qty=0 => delete
  async function changeQtyBy(name, price, delta) {
    setErrMsg('');
    const currentOrder = await ensureOrderOpen();
    if (!currentOrder?.id) return;

    const line = findOrderLine(name, price);
    const nextQty = (line?.qty || 0) + delta;

    if (nextQty <= 0) {
      if (!line?.id) return;
      const { error } = await supabase.from('order_items').delete().eq('id', line.id);
      if (error) {
        console.error('delete order_item error:', error);
        setErrMsg('Không xoá được món. Vui lòng thử lại.');
        return;
      }
      await loadOrderItems(currentOrder.id);
      return;
    }

    if (!line) {
      const { error } = await supabase.from('order_items').insert({
        order_id: currentOrder.id,
        item_name: name,
        price: Number(price || 0),
        qty: nextQty
      });
      if (error) {
        console.error('insert order_item error:', error);
        setErrMsg('Không thêm được món. Vui lòng thử lại.');
        return;
      }
      await loadOrderItems(currentOrder.id);
      return;
    }

    const { error } = await supabase.from('order_items').update({ qty: nextQty }).eq('id', line.id);
    if (error) {
      console.error('update order_item error:', error);
      setErrMsg('Không cập nhật được số lượng. Vui lòng thử lại.');
      return;
    }

    await loadOrderItems(currentOrder.id);
  }

  async function addItem(it) {
    await changeQtyBy(it.name, it.price, +1);
  }

  // ---------- CALC ----------
  const subTotal = useMemo(() => {
    return orderItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  }, [orderItems]);

  const effServicePercent = useMemo(() => {
    if (!serviceEnabled) return 0;
    const p = Number(servicePercent || 0);
    return p < 0 ? 0 : p;
  }, [serviceEnabled, servicePercent]);

  const serviceAmount = useMemo(() => {
    return Math.round((subTotal * effServicePercent) / 100);
  }, [subTotal, effServicePercent]);

  const finalTotal = useMemo(() => {
    return Math.round(subTotal + serviceAmount);
  }, [subTotal, serviceAmount]);

  // ---------- PAY ----------
  async function handlePay() {
    if (!order?.id || finalTotal <= 0 || paying) return;

    setPaying(true);
    setErrMsg('');

    try {
      const { error: payErr } = await supabase.from('payments').insert({
        order_id: order.id,
        method: payMethod,
        sub_total: subTotal,
        service_percent: effServicePercent,
        service_amount: serviceAmount,
        paid_amount: finalTotal
      });
      if (payErr) throw payErr;

      const { error: oErr } = await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);
      if (oErr) throw oErr;

      const { error: tErr } = await supabase.from('cafe_tables').update({ status: 'empty' }).eq('id', tableId);
      if (tErr) throw tErr;

      setOrder(null);
      setOrderItems([]);
      router.push('/history/today');
    } catch (e) {
      console.error('handlePay error:', e);
      setErrMsg('Không thanh toán được. Kiểm tra bảng payments đã có đủ cột sub_total/service_percent/service_amount.');
    } finally {
      setPaying(false);
    }
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Bàn {table?.name || ''}</h3>
          <div style={{ fontSize: 12, color: '#666' }}>{table?.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}</div>
        </div>
        <button onClick={() => router.push('/')}>Về chọn bàn</button>
      </div>

      {errMsg && <div style={{ marginBottom: 10, color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT */}
        <div style={{ flex: 1, borderRight: '1px solid #eee', paddingRight: 10 }}>
          <h4 style={{ marginTop: 0 }}>Chọn món</h4>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => addItem(it)}
                style={{
                  padding: '8px 8px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: '#fafafa'
                }}
              >
                <div style={{ fontWeight: 800 }}>{it.name}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{fmtVND(it.price)}</div>
                <div style={{ fontSize: 12, marginTop: 4, color: '#1976d2' }}>+1</div>
              </button>
            ))}
            {items.length === 0 && <div>Không có món trong nhóm này.</div>}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: 1 }}>
          <h4 style={{ marginTop: 0 }}>Đơn hiện tại</h4>

          {orderItems.length === 0 && <div>Chưa có món nào.</div>}

          {orderItems.length > 0 && (
            <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, marginBottom: 12 }}>
              {orderItems.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px dashed #eee'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{it.item_name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {fmtVND(it.price)} • {fmtVND(Number(it.price || 0) * Number(it.qty || 0))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => changeQtyBy(it.item_name, it.price, -1)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <div style={{ minWidth: 26, textAlign: 'center', fontWeight: 900 }}>{it.qty}</div>
                    <button
                      onClick={() => changeQtyBy(it.item_name, it.price, +1)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* POS breakdown + phí dịch vụ ngay trong order */}
          <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 900 }}>Tạm tính</div>
              <div style={{ fontWeight: 900 }}>{fmtVND(subTotal)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={serviceEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setServiceEnabled(on);
                    if (on) setServicePercent(servicePercentBackup > 0 ? servicePercentBackup : 5);
                    else setServicePercent(0);
                  }}
                />
                <span style={{ fontWeight: 800 }}>Phí dịch vụ</span>
              </label>

              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setServiceEnabled(false);
                    setServicePercent(0);
                  }}
                  style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid #ddd', cursor: 'pointer' }}
                >
                  0%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServiceEnabled(true);
                    setServicePercent(5);
                    setServicePercentBackup(5);
                  }}
                  style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid #ddd', cursor: 'pointer' }}
                >
                  5%
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setServiceEnabled(true);
                    setServicePercent(10);
                    setServicePercentBackup(10);
                  }}
                  style={{ padding: '2px 10px', borderRadius: 999, border: '1px solid #ddd', cursor: 'pointer' }}
                >
                  10%
                </button>

                <span style={{ marginLeft: 6 }}>Tự nhập:</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={serviceEnabled ? servicePercent : 0}
                  onChange={(e) => {
                    setServiceEnabled(true);
                    setServicePercent(e.target.value);
                    setServicePercentBackup(Number(e.target.value || 0));
                  }}
                  disabled={!serviceEnabled}
                  style={{ width: 80, padding: 4 }}
                />
                <span>%</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <div>Phí dịch vụ</div>
              <div>{fmtVND(serviceAmount)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, borderTop: '1px dashed #ddd', paddingTop: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>Tổng thanh toán</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{fmtVND(finalTotal)}</div>
            </div>

            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">Tiền mặt</option>
                <option value="transfer">Chuyển khoản</option>
              </select>

              <button
                onClick={handlePay}
                disabled={paying || !order?.id || finalTotal <= 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  cursor: paying || !order?.id || finalTotal <= 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 900,
                  background: paying ? '#f2f2f2' : '#fff'
                }}
              >
                {paying ? 'Đang thanh toán...' : 'Thanh toán'}
              </button>
            </div>

            <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
              Thanh toán sẽ lưu sub_total + service_fee + paid_amount vào bảng <strong>payments</strong>.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
