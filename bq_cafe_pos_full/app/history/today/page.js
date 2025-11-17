'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';

function startEndOfToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default function TodayHistoryPage() {
  const [rows, setRows] = useState([]);

  async function loadToday() {
    const { start, end } = startEndOfToday();
    const { data: payments } = await supabase
      .from('payments')
      .select('id, order_id, method, paid_amount, paid_at')
      .gte('paid_at', start)
      .lte('paid_at', end)
      .order('paid_at', { ascending: false });

    if (!payments || payments.length === 0) {
      setRows([]);
      return;
    }

    const orderIds = payments.map((p) => p.order_id);
    const { data: orders } = await supabase
      .from('orders')
      .select('id, table_name')
      .in('id', orderIds);

    const orderMap = new Map();
    (orders || []).forEach((o) => orderMap.set(o.id, o));

    const merged = payments.map((p) => ({
      ...p,
      table_name: orderMap.get(p.order_id)?.table_name || '',
    }));
    setRows(merged);
  }

  useEffect(() => {
    loadToday();
  }, []);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0),
    [rows]
  );

  return (
    <main style={{ padding: 16 }}>
      <h3>Lịch sử hóa đơn hôm nay</h3>
      <div style={{ marginBottom: 8 }}>
        <Link href="/"><button>Về màn hình chọn bàn</button></Link>
      </div>
      <div style={{ marginBottom: 8 }}>
        <strong>Tổng doanh thu: {total.toLocaleString('vi-VN')} đ</strong>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>Giờ</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>Bàn</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>Hình thức</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #eee' }}>Tiền</th>
            <th style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ padding: '4px 0' }}>
                {new Date(r.paid_at).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td>{r.table_name}</td>
              <td>{r.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
              <td style={{ textAlign: 'right' }}>
                {Number(r.paid_amount || 0).toLocaleString('vi-VN')} đ
              </td>
              <td style={{ textAlign: 'center' }}>
                <Link href={`/history/order/${r.order_id}`}>
                  <button>Xem</button>
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 8 }}>
                Chưa có bill nào hôm nay.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
