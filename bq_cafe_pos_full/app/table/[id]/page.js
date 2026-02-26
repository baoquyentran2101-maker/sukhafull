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

  // ===== POS (service fee: only 20% quick or custom input) =====
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [servicePercent, setServicePercent] = useState(20);
  const [servicePercentBackup, setServicePercentBackup] = useState(20);

  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);

  // ===== MOVE TABLE =====
  const [moveOpen, setMoveOpen] = useState(false);
  const [emptyTables, setEmptyTables] = useState([]);
  const [moveToTableId, setMoveToTableId] = useState('');
  const [moving, setMoving] = useState(false);

  // ===== UI =====
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // =========================
  // Helpers: empty/void logic
  // =========================
  async function setTableEmpty() {
    if (!tableId) return;

    const { error } = await supabase.from('cafe_tables').update({ status: 'empty' }).eq('id', tableId);
    if (error) console.error('setTableEmpty error:', error);

    setTable((prev) => (prev ? { ...prev, status: 'empty' } : prev));
    setOrder(null);
    setOrderItems([]);
  }

  async function voidOrder(orderId) {
    if (!orderId) return;

    // Nếu DB bạn không có status "void" -> đổi thành "cancelled" hoặc comment dòng này.
    const { error } = await supabase.from('orders').update({ status: 'void' }).eq('id', orderId);
    if (error) console.error('voidOrder error:', error);
  }

  async function handleEmptyOrder(orderId) {
    await voidOrder(orderId);
    await setTableEmpty();
  }

  // =========================
  // Loaders
  // =========================
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

  async function loadOrderItems(orderId, opts = {}) {
    if (!orderId) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const list = data || [];
    setOrderItems(list);

    // ✅ open order nhưng không có món => auto void + trả bàn trống
    if (opts.autoEmptyIfNone && list.length === 0) {
      await handleEmptyOrder(orderId);
    }
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

    // ✅ Không có open order => bàn trống
    if (!data?.length) {
      setOrder(null);
      setOrderItems([]);
      await setTableEmpty();
      return null;
    }

    const openOrder = data[0];
    setOrder(openOrder);

    await loadOrderItems(openOrder.id, { autoEmptyIfNone: true });
    return openOrder;
  }

  // =========================
  // Move table
  // =========================
  async function loadEmptyTables() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, status')
      .eq('status', 'empty')
      .order('name', { ascending: true });

    if (error) {
      console.error('loadEmptyTables error:', error);
      setEmptyTables([]);
      return;
    }
    setEmptyTables(data || []);
  }

  async function moveOrderToTable() {
    if (!order?.id) {
      setErrMsg('Chưa có đơn mở để đổi bàn.');
      return;
    }
    if (!moveToTableId) return;
    if (moveToTableId === tableId) return;

    setMoving(true);
    setErrMsg('');

    try {
      const { data: newTable, error: tErr } = await supabase
        .from('cafe_tables')
        .select('id, name, status')
        .eq('id', moveToTableId)
        .single();

      if (tErr) throw tErr;
      if (!newTable) throw new Error('Không tìm thấy bàn mới.');
      if (newTable.status !== 'empty') {
        setErrMsg('Bàn mới không còn trống. Hãy chọn bàn khác.');
        return;
      }

      // 1) cập nhật order sang bàn mới
      const { error: oErr } = await supabase
        .from('orders')
        .update({ table_id: newTable.id, table_name: newTable.name })
        .eq('id', order.id);

      if (oErr) throw oErr;

      // 2) set bàn mới in_use
      const { error: nErr } = await supabase.from('cafe_tables').update({ status: 'in_use' }).eq('id', newTable.id);
      if (nErr) throw nErr;

      // 3) set bàn cũ empty
      const { error: oldTErr } = await supabase.from('cafe_tables').update({ status: 'empty' }).eq('id', tableId);
      if (oldTErr) console.error('set old table empty error:', oldTErr);

      // 4) chuyển qua route bàn mới
      setMoveOpen(false);
      setMoveToTableId('');
      router.push(`/table/${newTable.id}`);
    } catch (e) {
      console.error('moveOrderToTable error:', e);
      setErrMsg(`Không đổi bàn được: ${e?.message || 'Lỗi không xác định'}`);
    } finally {
      setMoving(false);
    }
  }

  // =========================
  // Effects
  // =========================
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

  // =========================
  // Order helpers
  // =========================
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

    const { error: tErr } = await supabase.from('cafe_tables').update({ status: 'in_use' }).eq('id', tableId);
    if (tErr) console.error('set table in_use error:', tErr);

    setTable((prev) => (prev ? { ...prev, status: 'in_use' } : prev));

    return data;
  }

  function findOrderLine(name, price) {
    return orderItems.find((x) => x.item_name === name && Number(x.price || 0) === Number(price || 0));
  }

  async function changeQtyBy(name, price, delta) {
    setErrMsg('');

    const currentOrder = await ensureOrderOpen();
    if (!currentOrder?.id) return;

    const line = findOrderLine(name, price);
    const nextQty = (line?.qty || 0) + delta;

    // qty <= 0 => delete line
    if (nextQty <= 0) {
      if (!line?.id) return;

      const { error } = await supabase.from('order_items').delete().eq('id', line.id);
      if (error) {
        console.error('delete order_item error:', error);
        setErrMsg('Không xoá được món. Vui lòng thử lại.');
        return;
      }

      await loadOrderItems(currentOrder.id);

      // ✅ nếu đơn rỗng => auto void + empty
      const { data: remain, error: rErr } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', currentOrder.id)
        .limit(1);

      if (rErr) console.error('check remain items error:', rErr);
      if (!remain?.length) await handleEmptyOrder(currentOrder.id);

      return;
    }

    // insert new line
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

    // update qty
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

  // =========================
  // Calc
  // =========================
  const subTotal = useMemo(
    () => orderItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0),
    [orderItems]
  );

  const effServicePercent = useMemo(() => {
    if (!serviceEnabled) return 0;
    const p = Number(servicePercent || 0);
    return p < 0 ? 0 : p;
  }, [serviceEnabled, servicePercent]);

  const serviceAmount = useMemo(() => Math.round((subTotal * effServicePercent) / 100), [subTotal, effServicePercent]);

  const finalTotal = useMemo(() => Math.round(subTotal + serviceAmount), [subTotal, serviceAmount]);

  // =========================
  // Pay
  // =========================
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

      setTable((prev) => (prev ? { ...prev, status: 'empty' } : prev));
      setOrder(null);
      setOrderItems([]);

      router.push('/history/today');
    } catch (e) {
      console.error('handlePay error:', e);
      setErrMsg('Không thanh toán được. Kiểm tra bảng payments có đủ cột sub_total/service_percent/service_amount.');
    } finally {
      setPaying(false);
    }
  }

  // =========================
  // UI
  // =========================
  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Bàn {table?.name || ''}</h3>
          <div style={{ fontSize: 12, color: '#666' }}>{table?.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            onClick={async () => {
              if (!order?.id) {
                setErrMsg('Chưa có đơn mở để đổi bàn.');
                return;
              }
              setMoveOpen(true);
              await loadEmptyTables();
            }}
            disabled={!order?.id}
          >
            Đổi bàn
          </button>

          <button onClick={() => router.push('/')}>Về chọn bàn</button>
        </div>
      </div>

      {errMsg && <div style={{ marginBottom: 10, color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

      {/* Move table box */}
      {moveOpen && (
        <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontWeight: 900 }}>Đổi bàn</div>
            <button onClick={() => setMoveOpen(false)} disabled={moving}>
              Đóng
            </button>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={moveToTableId}
              onChange={(e) => setMoveToTableId(e.target.value)}
              style={{ padding: 8, borderRadius: 10, border: '1px solid #ddd', minWidth: 180 }}
            >
              <option value="">Chọn bàn trống...</option>
              {emptyTables.map((t) => (
                <option key={t.id} value={t.id}>
                  Bàn {t.name}
                </option>
              ))}
            </select>

            <button
              onClick={moveOrderToTable}
              disabled={moving || !moveToTableId}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 900 }}
            >
              {moving ? 'Đang đổi...' : 'Xác nhận đổi bàn'}
            </button>

            <button
              onClick={loadEmptyTables}
              disabled={moving}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd' }}
            >
              Tải lại danh sách
            </button>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            Chỉ hiển thị <strong>bàn trống</strong> để tránh ghi đè order của bàn khác.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT: Menu */}
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

        {/* RIGHT: Order + POS */}
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
                      title="Giảm"
                    >
                      -
                    </button>
                    <div style={{ minWidth: 26, textAlign: 'center', fontWeight: 900 }}>{it.qty}</div>
                    <button
                      onClick={() => changeQtyBy(it.item_name, it.price, +1)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer' }}
                      title="Tăng"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* POS breakdown + service fee */}
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
                    if (!on) setServicePercent(0);
                    else setServicePercent(servicePercentBackup > 0 ? servicePercentBackup : 20);
                  }}
                />
                <span style={{ fontWeight: 800 }}>Phí dịch vụ</span>
              </label>

              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setServiceEnabled(true);
                    setServicePercent(20);
                    setServicePercentBackup(20);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: '1px solid #ddd',
                    cursor: 'pointer',
                    background: serviceEnabled && Number(servicePercent) === 20 ? '#e3f2fd' : '#fff',
                    fontWeight: 800
                  }}
                >
                  20%
                </button>

                <span style={{ marginLeft: 6 }}>Tự nhập:</span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={serviceEnabled ? servicePercent : 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setServiceEnabled(true);
                    setServicePercent(v);
                    setServicePercentBackup(Number(v || 0));
                  }}
                  disabled={!serviceEnabled}
                  style={{ width: 90, padding: 6, borderRadius: 8, border: '1px solid #ddd' }}
                  placeholder="0"
                />
                <span>%</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <div>Phí dịch vụ ({effServicePercent}%)</div>
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
