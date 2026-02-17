'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function OrderHistoryDetailPage({ params }) {
  const orderId = params.id;
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  // POS editable controls
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [servicePercent, setServicePercent] = useState(5);

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
    setItems(data || []);
  }

  async function loadPayment() {
    // Lấy payment mới nhất theo paid_at; nếu paid_at null thì vẫn lấy record mới nhất theo created_at fallback (nếu có)
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

  // Khi payment thay đổi -> set state service (để chỉnh)
  useEffect(() => {
    // Nếu payment có service_percent thì dùng nó; nếu không thì mặc định 0 và tắt
    const sp = payment?.service_percent;
    if (sp == null) {
      setServiceEnabled(false);
      setServicePercent(0);
      return;
    }

    const num = Number(sp || 0);
    setServiceEnabled(num > 0);
    setServicePercent(num);
  }, [payment]);

  // ===== Group items (gộp theo tên + giá) =====
  const groupedItems = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = `${it.item_name}__${Number(it.price || 0)}`;
      const prev =
        map.get(key) || {
          name: it.item_name,
          price: Number(it.price || 0),
          qty: 0,
          total: 0
        };

      const qty = Number(it.qty || 0);
      const lineTotal =
        it.amount != null ? Number(it.amount) : Number(it.price || 0) * qty;

      prev.qty += qty;
      prev.total += lineTotal;

      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [items]);

  const computedSubTotal = useMemo(() => {
    return groupedItems.reduce((s, it) => s + Number(it.total || 0), 0);
  }, [groupedItems]);

  // ===== Source of truth for sub_total =====
  // Nếu payment có sub_total -> dùng; nếu không -> fallback tính từ items
  const subTotal = useMemo(() => {
    if (payment?.sub_total != null) return Number(payment.sub_total);
    return computedSubTotal;
  }, [payment, computedSubTotal]);

  // ===== POS calculations =====
  const effectiveServicePercent = useMemo(() => {
    if (!serviceEnabled) return 0;
    return Math.max(0, Number(servicePercent || 0));
  }, [serviceEnabled, servicePercent]);

  const serviceAmount = useMemo(() => {
    return Math.round((subTotal * effectiveServicePercent) / 100);
  }, [subTotal, effectiveServicePercent]);

  const finalTotal = useMemo(() => {
    return Math.round(subTotal + serviceAmount);
  }, [subTotal, serviceAmount]);

  const paidAtText = useMemo(() => {
    if (!payment?.paid_at) return '';
    const d = new Date(payment.paid_at);
    return isNaN(d.getTime()) ? String(payment.paid_at) : d.toLocaleString('vi-VN');
  }, [payment]);

  const isDirty = useMemo(() => {
    // So sánh với payment hiện tại để biết có thay đổi không
    const pSub = payment?.sub_total != null ? Number(payment.sub_total) : subTotal;
    const pSP = payment?.service_percent != null ? Number(payment.service_percent) : 0;
    const pSA = payment?.service_amount != null ? Number(payment.service_amount) : 0;
    const pPaid = payment?.paid_amount != null ? Number(payment.paid_amount) : pSub + pSA;

    return (
      pSub !== subTotal ||
      pSP !== effectiveServicePercent ||
      pSA !== serviceAmount ||
      pPaid !== finalTotal
    );
  }, [payment, subTotal, effectiveServicePercent, serviceAmount, finalTotal]);

  async function handleUpdatePayment() {
    if (!payment?.id) return;

    setSaving(true);
    setErrMsg('');

    // Update payment with new totals (POS breakdown)
    const payload = {
      sub_total: subTotal,
      service_percent: effectiveServicePercent,
      service_amount: serviceAmount,
      paid_amount: finalTotal
    };

    const { error } = await supabase.from('payments').update(payload).eq('id', payment.id);

    if (error) {
      console.error('update payment error:', error);
      setErrMsg(
        'Không cập nhật được thanh toán. Kiểm tra bảng payments đã có cột sub_total/service_percent/service_amount chưa.'
      );
      setSaving(false);
      return;
    }

    await loadPayment();
    setSaving(false);
  }

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
                  <td style={{ textAlign: 'right' }}>
                    {Number(it.price || 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {Number(it.total || 0).toLocaleString('vi-VN')} đ
                  </td>
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
            Đơn này chưa có bản ghi thanh toán trong bảng <strong>payments</strong>.
          </div>
        )}

        {/* Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, columnGap: 12 }}>
          <div style={{ fontWeight: 700 }}>Tạm tính</div>
          <div style={{ fontWeight: 700 }}>{subTotal.toLocaleString('vi-VN')} đ</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={serviceEnabled}
                onChange={(e) => setServiceEnabled(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Phí dịch vụ</span>
            </div>
