'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function OrderHistoryPage({ params }) {
  const orderId = params.id;
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [payment, setPayment] = useState(null);

  async function loadAll() {
    const { data: od } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    setOrder(od);

    const { data: its } = await supabase
      .from('order_items')
      .select('item_name, price, qty, amount')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    setItems(its || []);

    const { data: pay } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('paid_at', { ascending: false })
      .limit(1);
    if (pay && pay.length > 0) setPayment(pay[0]);
  }

  useEffect(() => {
    loadAll();
  }, [orderId]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.item_name;
      const prev = map.get(key) || { name: key, qty: 0, total: 0, price: it.price };
      prev.qty += it.qty;
      prev.total += Number(it.amount || 0);
      map.set(key, prev);
    }
    return Array.from(map.values());
  }, [items]);

  const total = useMemo(
    () => grouped.reduce((s, it) => s + it.total, 0),
    [grouped]
  );

  return (
    <main style={{ padding: 16 }}>
      <button onClick={() => router.back()} style={{ marginBottom: 8 }}>
        ← Quay lại
      </button>
      <h3>Chi tiết hóa đơn</h3>
      {order && (
        <div style={{ marginBottom: 8 }}>
          <div>Bàn: <strong>{order.table_name}</strong></div>
          <div>
            Giờ tạo:{' '}
            {new Date(order.created_at).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
            })}
          </div>
        </div>
      )}
      {payment && (
        <div style={{ marginBottom: 8 }}>
          <div>
            Thanh toán:{' '}
            {new Date(payment.paid_at).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div>Hình thức: {payment.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</div>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>Món</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>SL</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>Tiền</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((it) => (
            <tr key={it.name}>
              <td style={{ padding: '4px 0' }}>{it.name}</td>
              <td style={{ textAlign: 'right' }}>{it.qty}</td>
              <td style={{ textAlign: 'right' }}>
                {it.total.toLocaleString('vi-VN')} đ
              </td>
            </tr>
          ))}
          {grouped.length === 0 && (
            <tr>
              <td colSpan={3} style={{ padding: 8 }}>
                Không có dữ liệu món.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div>
        <strong>Tổng: {total.toLocaleString('vi-VN')} đ</strong>
      </div>
    </main>
  );
}
