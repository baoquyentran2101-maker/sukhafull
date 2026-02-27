'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

export default function OrderHistoryDetailPage({ params }) {
  const orderId = params?.id;
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!orderId) return;

      if (alive) {
        setLoading(true);
        setErrMsg('');
      }

      try {
        // 1) Order
        const { data: o, error: oErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        if (oErr) throw oErr;

        // 2) Order items (món đã dùng)
        const { data: oi, error: oiErr } = await supabase
          .from('order_items')
          .select('id, item_name, price, qty, created_at')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });
        if (oiErr) throw oiErr;

        // 3) Latest payment (paid_at có thể null => order thêm theo id)
        const { data: p, error: pErr } = await supabase
          .from('payments')
          .select('id, order_id, method, sub_total, service_percent, service_amount, paid_amount, paid_at, created_at')
          .eq('order_id', orderId)
          .order('paid_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);
        if (pErr) throw pErr;

        if (!alive) return;
        setOrder(o || null);
        setOrderItems(oi || []);
        setPayment(p?.[0] || null);
      } catch (e) {
        console.error('OrderHistoryDetail load error:', e);
        if (!alive) return;
        setErrMsg('Không tải được dữ liệu. Vui lòng kiểm tra lại (orders/payments/order_items).');
        setOrder(null);
        setPayment(null);
        setOrderItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [orderId]);

  // ===== Calculations =====
  const computedSubTotal = useMemo(() => {
    return orderItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  }, [orderItems]);

  // Ưu tiên sub_total trong payment nếu có, fallback theo order_items
  const subTotal = useMemo(() => {
    if (payment?.sub_total != null) return Number(payment.sub_total);
    return computedSubTotal;
  }, [payment, computedSubTotal]);

  const servicePercent = useMemo(() => Number(payment?.service_percent || 0), [payment]);
  const serviceAmount = useMemo(() => {
    // ưu tiên số đã lưu trong DB
    if (payment?.service_amount != null) return Number(payment.service_amount);
    return Math.round((subTotal * servicePercent) / 100);
  }, [payment, subTotal, servicePercent]);

  const finalTotal = useMemo(() => {
    if (payment?.paid_amount != null) return Number(payment.paid_amount);
    return Math.round(subTotal + serviceAmount);
  }, [payment, subTotal, serviceAmount]);

  const paidAtText = useMemo(() => {
    const raw = payment?.paid_at || payment?.created_at;
    if (!raw) return '-';
    const d = new Date(raw);
    return isNaN(d.getTime()) ? String(raw) : d.toLocaleString('vi-VN');
  }, [payment]);

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
        <div>{errMsg || 'Không tìm thấy đơn hàng.'}</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <button onClick={() => router.back()} style={{ marginBottom: 12 }}>
        ← Quay lại
      </button>

      <h3 style={{ marginTop: 0 }}>Chi tiết thanh toán</h3>

      <div style={{ marginBottom: 10, fontSize: 13, color: '#666' }}>
        Bàn: <strong>{order.table_name || order.table_id || ''}</strong> • Trạng thái:{' '}
        <strong>{order.status}</strong>
      </div>

      {errMsg && (
        <div style={{ marginBottom: 10, color: '#b00020', fontSize: 13 }}>
          {errMsg}
        </div>
      )}

      {/* Items */}
      <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 10, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Món đã dùng</div>

        {orderItems.length === 0 ? (
          <div style={{ color: '#666' }}>Không có món nào trong đơn này.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Món</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>SL</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Đơn giá</th>
                <th style={{ textAlign: 'right', borderBottom: '1px solid #eee', paddingBottom: 6 }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((it) => {
                const lineTotal = Number(it.price || 0) * Number(it.qty || 0);
                return (
                  <tr key={it.id}>
                    <td style={{ padding: '6px 0' }}>{it.item_name}</td>
                    <td style={{ textAlign: 'right' }}>{it.qty}</td>
                    <td style={{ textAlign: 'right' }}>{fmtVND(it.price)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtVND(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!payment && <div>Đơn này chưa có thanh toán.</div>}

      {payment && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 10, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Tạm tính</div>
            <div style={{ fontWeight: 700 }}>{fmtVND(subTotal)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>Phí dịch vụ ({servicePercent}%)</div>
            <div>{fmtVND(serviceAmount)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #ddd', paddingTop: 10 }}>
            <div style={{ fontWeight: 900 }}>Tổng thanh toán</div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{fmtVND(finalTotal)}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
            Phương thức: <strong>{payment.method || '-'}</strong> • Thời gian: <strong>{paidAtText}</strong>
          </div>
        </div>
      )}
    </main>
  );
}
