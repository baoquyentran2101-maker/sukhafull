'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function OrderHistoryDetailPage({ params }) {
  const orderId = params.id;
  const router = useRouter();

  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: o } = await supabase.from('orders').select('*').eq('id', orderId).single();
      const { data: p } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', orderId)
        .limit(1);

      setOrder(o);
      setPayment(p?.[0] || null);
    }
    load();
  }, [orderId]);

  if (!order) return <div style={{ padding: 16 }}>Đang tải...</div>;

  return (
    <main style={{ padding: 16 }}>
      <button onClick={() => router.back()}>← Quay lại</button>

      <h3>Chi tiết thanh toán</h3>

      {payment && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <div>Tạm tính: {Number(payment.sub_total || 0).toLocaleString('vi-VN')} đ</div>
          <div>
            Phí dịch vụ ({payment.service_percent || 0}%):
            {Number(payment.service_amount || 0).toLocaleString('vi-VN')} đ
          </div>
          <div>
            <strong>
              Tổng: {Number(payment.paid_amount || 0).toLocaleString('vi-VN')} đ
            </strong>
          </div>
          <div>Phương thức: {payment.method}</div>
        </div>
      )}
    </main>
  );
}
