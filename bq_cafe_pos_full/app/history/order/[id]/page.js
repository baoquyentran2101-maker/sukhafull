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
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrMsg('');

      try {
        // 1) Order
        const { data: o, error: oErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (oErr) throw oErr;

        // 2) Latest payment (nếu paid_at null vẫn lấy record mới nhất theo id)
        const { data: p, error: pErr } = await supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .order('paid_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(1);

        if (pErr) throw pErr;

        if (!alive) return;
        setOrder(o || null);
        setPayment(p?.[0] || null);
      } catch (e) {
        console.error('load history order detail error:', e);
        if (!alive) return;
        setErrMsg('Không tải được dữ liệu. Vui lòng kiểm tra lại.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [orderId]);

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

      {!payment && <div>Đơn này chưa có thanh toán.</div>}

      {payment && (
        <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 10, background: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Tạm tính</div>
            <div style={{ fontWeight: 700 }}>
              {Number(payment.sub_total || 0).toLocaleString('vi-VN')} đ
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              Phí dịch vụ ({Number(payment.service_percent || 0)}%)
            </div>
            <div>{Number(payment.service_amount || 0).toLocaleString('vi-VN')} đ</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #ddd', paddingTop: 10 }}>
            <div style={{ fontWeight: 900 }}>Tổng thanh toán</div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {Number(payment.paid_amount || 0).toLocaleString('vi-VN')} đ
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
            Phương thức: <strong>{payment.method || '-'}</strong>
          </div>
        </div>
      )}
    </main>
  );
}
