'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function toDateKey(d) {
  // YYYY-MM-DD theo giờ local
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatVNDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export default function HistoryTodayPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  async function loadPayments() {
    setErrMsg('');
    const { data, error } = await supabase
      .from('payments')
      .select('id, method, sub_total, service_percent, service_amount, paid_amount, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('load payments error:', error);
      setErrMsg('Không tải được lịch sử. Kiểm tra RLS/policy SELECT cho payments và cột created_at.');
      setRows([]);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadPayments();
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map(); // dateKey -> list
    for (const r of rows) {
      const k = toDateKey(r.created_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({
      dateKey: k,
      list: map.get(k),
      total: map.get(k).reduce((s, x) => s + Number(x.paid_amount || 0), 0)
    }));
  }, [rows]);

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Lịch sử thanh toán</h3>
          <div style={{ fontSize: 12, color: '#666' }}>Chia theo ngày</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadPayments}>Tải lại</button>
          <button onClick={() => router.push('/')}>Về chọn bàn</button>
        </div>
      </div>

      {errMsg && <div style={{ marginTop: 10, color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

      {grouped.length === 0 && !errMsg && <div style={{ marginTop: 16, color: '#666' }}>Chưa có thanh toán.</div>}

      <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        {grouped.map((g) => (
          <div key={g.dateKey} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 900 }}>{formatVNDate(g.dateKey)}</div>
              <div style={{ fontWeight: 900 }}>Tổng: {fmtVND(g.total)}</div>
            </div>

            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {g.list.map((r) => (
                <div
                  key={r.id}
                  style={{
                    borderTop: '1px dashed #eee',
                    paddingTop: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 10,
                    alignItems: 'center'
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 800 }}>
                      {new Date(r.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {r.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      Tạm tính: {fmtVND(r.sub_total)} • Phí DV: {fmtVND(r.service_amount)} ({Number(r.service_percent || 0)}
                      %)
                    </div>
                  </div>

                  <div style={{ fontWeight: 900 }}>{fmtVND(r.paid_amount)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
