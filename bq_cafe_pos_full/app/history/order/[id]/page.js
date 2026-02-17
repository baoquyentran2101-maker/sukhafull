'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function OrderHistoryDetailPage({ params }) {
  const orderId = params.id;
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: o } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      const { data: p } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .order('paid_at', { ascending: false })
        .limit(1);

      setOrder(o || null);
      setPayment(p?.[0] || null);
      setLoading(false);
    }

    load();
  }, [orderId]);

  if (loading) return <main style={{ padding: 16 }}>Đang tải...</main>;
  if (!order) return <main style={{ padding: 16 }}>Không tìm thấy đơn</main>;

  return (
    <main style={{ padding: 16 }}>
      <button onClick={() => router.back()}>← Quay lại</button>

      <h3>Chi tiết thanh toán</h3>

      {!payment && <div>Đơn này chưa có thanh toán.</div>}

      {payment && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <div>
            Tạm tính: {Number(payment.sub_total || 0).toLocaleString('vi-VN')} đ
          </div>

          <div>
            Phí dịch vụ ({payment.service_percent || 0}%):
            {Number(payment.service_amount || 0).toLocaleString('vi-VN')} đ
          </div>

          <div style={{ fontWeight: 800 }}>
            Tổng: {Number(payment.paid_amount || 0).toLocaleString('vi-VN')} đ
          </div>

          <div>Phương thức: {payment.method}</div>
        </div>
      )}
    </main>
  );
}
