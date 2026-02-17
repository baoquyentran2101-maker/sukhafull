'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function OrderHistoryDetailPage({ params }) {
  const orderId = params.id;
  const router = useRouter();

  // ===== Data states =====
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [payment, setPayment] = useState(null);

  // ===== UI states =====
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // ===== POS controls (editable) =====
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [servicePercent, setServicePercent] = useState(5);

  // ---------- Loaders ----------
  async function loadOrder() {
    const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error) console.error('loadOrder error:', error);
    setOrder(data || null);
  }

  async function loadOrderItems() {
    const { data, error } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty, amount, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) console.error('loadOrderItems error:', error);
    setOrderItems(data || []);
  }

  async function loadPayment() {
    const { data, error } = await supabase
      .from('payments')
      .select('id, order_id, method, sub_total, service_percent, service_amount, paid_amount, paid_at')
      .eq('order_id', orderId)
      .order('paid_at', { ascending: false })
      .limit(1);

    if (error) console.error('loadPayment error:', error);
    setPayment(data && data.length > 0 ? data[0] : null);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg('');
      await Promise.all([loadOrder(), loadOrderItems(), loadPayment()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Sync POS controls from payment (when payment changes)
  useEffect(() => {
    const p = payment?.service_percent;
    const sp = Number(p ?? 0);
    setServiceEnabled(sp > 0);
    setServicePercent(sp > 0 ? sp : 5);
  }, [payment]);

  // ---------- Computations ----------
  const groupedItems = useMemo(() => {
    // gộp theo (name + price) để tránh sai khi cùng tên khác giá
    const map = new Map();
    for (const it of orderItems) {
      const name = it.item_name || '';
      const price = Number(it.price || 0);
      const key = `${name}__${price}`;

      const qty = Number(it.qty || 0);
      const lineTotal = it.amount != null ? Number(it.amount) : price * qty;

      const prev = map.get(key) || { name, price, qty: 0, total: 0 };
      prev.qty += qty;
      prev.total += lineTotal;

      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [orderItems]);

  const computedSubTotal = useMemo(() => {
    return groupedItems.reduce((s, it) => s + Number(it.total || 0), 0);
  }, [groupedItems]);

  // Ưu tiên sub_total trong payments (nếu có), fallback từ order_items
  const subTotal = useMemo(() => {
    if (payment?.sub_total != null) return Number(payment.sub_total);
    return computedSubTotal;
  }, [payment, computedSubTotal]);

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

  const paymentPaidAmount = useMemo(() => {
    if (payment?.paid_amount != null) return Number(payment.paid_amount);
    return finalTotal;
  }, [payment, finalTotal]);

  const paidAtText = useMemo(() => {
    if (!payment?.paid_at) return '-';
    const d = new Date(payment.paid_at);
    return isNaN(d.getTime()) ? String(payment.paid_at) : d.toLocaleString('vi-VN');
  }, [payment]);

  const isDirty = useMemo(() => {
    if (!payment?.id) return false;

    const pSub = payment?.sub_total != null ? Number(payment.sub_total) : subTotal;
    const pSP = payment?.service_percent != null ? Number(payment.service_percent) : 0;
    const pSA = payment?.service_amount != null ? Number(payment.service_amount) : 0;
    const pPaid = payment?.paid_amount != null ? Number(payment.paid_amount) : pSub + pSA;

    return (
      Math.round(pSub) !== Math.round(subTotal) ||
      Math.round(pSP * 100) !== Math.round(effServicePercent * 100) || // tránh lệch do float
      Math.round(pSA) !== Math.round(serviceAmount) ||
      Math.round(pPaid) !== Math.round(finalTotal)
    );
  }, [payment, subTotal, effServicePercent, serviceAmount, finalTotal]);

  // ---------- Actions ----------
  async function updatePayment() {
    if (!payment?.id) return;

    setSaving(true);
    setErrMsg('');

    const payload = {
      sub_total: subTotal,
      service_percent: effServicePercent,
      service_amount: serviceAmount,
      paid_amount: finalTotal
    };

    const { error } = await supabase.from('payments').update(payload).eq('id', payment.id);

    if (error) {
      console.error('updatePayment error:', error);
      setErrMsg(
        'Không cập nhật được. Hãy kiểm tra bảng payments đã có cột sub_total, service_percent, service_amount chưa.'
      );
      setSaving(false);
      return;
    }

    await loadPayment();
    setSaving(false);
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  if (!order) {
    return (
      <main style={{ padding: 16 }}>
        <button onClick={() => router.back()} style={{ marginBottom: 12 }}>
          ← Quay lại
        </button>
        <div>Không tìm thấy đơn hàng.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Chi tiết đơn</h3>
          <div style={{ fontSize: 13, color: '#666' }}>
            Bàn: <strong>{order.table_name || order.table_id || ''}</strong> • Trạng thái:{' '}
            <strong>{order.status}</strong>
          </div>
        </div>
        <button onClick={() => router.back()}>← Quay lại</button>
      </div>

      {/* Items */}
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <h4 style={{ marginTop: 0 }}>Món đã gọi</h4>

        {groupedItems.length === 0 ? (
          <div>Không có món nào.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 6 }}>
                  Món
                </th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>
                  SL
                </th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>
                  Đơn giá
                </th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map((it) => (
                <tr key={`${it.name}-${it.price}`}>
                  <td style={{ padding: '6px 0' }}>{it.name}</td>
                  <td style={{ textAlign: 'right' }}>{it.qty}</td>
                  <td style={{ textAlign: 'right' }}>{it.price.toLocaleString('vi-VN')} đ</td>
                  <td style={{ textAlign: 'right' }}>{it.total.toLocaleString('vi-VN')} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Payment POS */}
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fafafa' }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>Thanh toán</h4>

        {!payment && (
          <div style={{ marginBottom: 10, fontSize: 13, color: '#777' }}>
            Đơn này chưa có bản ghi thanh toán trong <strong>payments</strong>.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, columnGap: 12 }}>
          <div style={{ fontWeight: 700 }}>Tạm tính</div>
          <div style={{ fontWeight: 700 }}>{subTotal.toLocaleString('vi-VN')} đ</div>

          {/* Service fee controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={serviceEnabled}
                onChange={(e) => setServiceEnabled(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Phí dịch vụ</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                }}
                disabled={!serviceEnabled}
                style={{ width: 80, padding: 4 }}
              />
              <span>%</span>
            </div>
          </div>

          <div style={{ alignSelf: 'start' }}>{serviceAmount.toLocaleString('vi-VN')} đ</div>

          <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, fontSize: 16, fontWeight: 900 }}>
            Tổng thanh toán
          </div>
          <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, fontSize: 18, fontWeight: 900 }}>
            {finalTotal.toLocaleString('vi-VN')} đ
          </div>

          <div style={{ marginTop: 4, color: '#666' }}>Phương thức</div>
          <div style={{ marginTop: 4 }}>{payment?.method || '-'}</div>

          <div style={{ color: '#666' }}>Thời gian</div>
          <div>{paidAtText}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          {errMsg && <div style={{ marginRight: 'auto', color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

          <button
            type="button"
            onClick={updatePayment}
            disabled={!payment?.id || saving || !isDirty}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #ddd',
              background: !payment?.id || !isDirty ? '#f2f2f2' : '#fff',
              cursor: !payment?.id || !isDirty ? 'not-allowed' : 'pointer',
              fontWeight: 800
            }}
          >
            {saving ? 'Đang cập nhật...' : 'Cập nhật thanh toán'}
          </button>
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: '#777' }}>
          Đang lưu: sub_total + phí dịch vụ + paid_amount vào bảng payments.
        </div>

        {/* Optional quick audit line */}
        {payment?.id && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            (Hiện tại trong DB: paid_amount = {paymentPaidAmount.toLocaleString('vi-VN')} đ)
          </div>
        )}
      </div>
    </main>
  );
}
