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

  async function loadOrder() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

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
    // lấy payment mới nhất của order (nếu có nhiều lần thanh toán)
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
      await Promise.all([loadOrder(), loadOrderItems(), loadPayment()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Gom nhóm giống màn hình bàn: tổng qty theo item_name
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

  // Fallback khi payment cũ chưa có cột service/sub_total:
  const subTotal = payment?.sub_total != null ? Number(payment.sub_total) : computedSubTotal;
  const servicePercent = payment?.service_percent != null ? Number(payment.service_percent) : 0;
  const serviceAmount = payment?.service_amount != null ? Number(payment.service_amount) : 0;

  const paidAmount = useMemo(() => {
    // ưu tiên paid_amount từ payment; nếu null thì tự tính
    if (payment?.paid_amount != null) return Number(payment.paid_amount);
    return Math.round(subTotal + serviceAmount);
  }, [payment, subTotal, serviceAmount]);

  const paidAtText = useMemo(() => {
    if (!payment?.paid_at) return '';
    const d = new Date(payment.paid_at);
    return isNaN(d.getTime()) ? String(payment.paid_at) : d.toLocaleString('vi-VN');
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
        <div>Không tìm thấy đơn hàng.</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Chi tiết đơn</h3>
          <div style={{ fontSize: 13, color: '#666' }}>
            Bàn: <strong>{order.table_name || order.table_id || ''}</strong> • Trạng thái:{' '}
            <strong>{order.status}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.back()}>← Quay lại</button>
        </div>
      </div>

      {/* Danh sách món */}
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

      {/* Thanh toán + phí dịch vụ */}
      <div style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fafafa' }}>
        <h4 style={{ marginTop: 0 }}>Thanh toán</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
          <div style={{ fontWeight: 600 }}>Tạm tính</div>
          <div style={{ fontWeight: 600 }}>{subTotal.toLocaleString('vi-VN')} đ</div>

          <div>
            Phí dịch vụ {servicePercent ? `(${servicePercent}%)` : ''}
          </div>
          <div>{serviceAmount.toLocaleString('vi-VN')} đ</div>

          <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, fontSize: 16, fontWeight: 800 }}>
            Tổng thanh toán
          </div>
          <div style={{ borderTop: '1px dashed #ddd', paddingTop: 10, fontSize: 18, fontWeight: 900 }}>
            {paidAmount.toLocaleString('vi-VN')} đ
          </div>

          <div style={{ marginTop: 6, color: '#666' }}>Phương thức</div>
          <div style={{ marginTop: 6 }}>{payment?.method || '-'}</div>

          <div style={{ color: '#666' }}>Thời gian</div>
          <div>{paidAtText || '-'}</div>
        </div>

        {!payment && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#777' }}>
            (Đơn này chưa có bản ghi thanh toán trong bảng payments.)
          </div>
        )}
      </div>
    </main>
  );
}
