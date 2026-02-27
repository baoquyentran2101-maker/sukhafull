'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

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

function localDayRangeToISO(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function HistoryByDatePage({ params }) {
  const router = useRouter();
  const dateKey = params?.date;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  async function loadPaymentsOfDay() {
    if (!dateKey) return;
    setErrMsg('');

    const { startISO, endISO } = localDayRangeToISO(dateKey);

    const { data, error } = await supabase
      .from('payments')
      .select('id, method, sub_total, service_percent, service_amount, paid_amount, created_at')
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      setErrMsg('Không tải được dữ liệu ngày này.');
      setRows([]);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadPaymentsOfDay();
      setLoading(false);
    })();
  }, [dateKey]);

  const total = useMemo(
    () => rows.reduce((s, x) => s + Number(x.paid_amount || 0), 0),
    [rows]
  );

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
          <h3 style={{ margin: 0 }}>
            {dateKey ? formatVNDate(dateKey) : 'Chi tiết ngày'}
          </h3>
          <div style={{ fontSize: 12, color: '#666' }}>
            {rows.length} giao dịch • Tổng: <strong>{fmtVND(total)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/history/today')}>
            Chọn ngày khác
          </button>
        </div>
      </div>

      {errMsg && (
        <div style={{ marginTop: 10, color: '#b00020' }}>
          {errMsg}
        </div>
      )}

      <div style={{ marginTop: 14, border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
        {rows.map((r, idx) => (
          <div
            key={r.id}
            style={{
              padding: 12,
              borderTop: idx === 0 ? 'none' : '1px dashed #eee',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 900 }}>
                {new Date(r.created_at).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}{' '}
                • {r.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
              </div>

              <div style={{ fontSize: 12, color: '#666' }}>
                Tạm tính: {fmtVND(r.sub_total)} • 
                Phí DV: {fmtVND(r.service_amount)} ({Number(r.service_percent || 0)}%)
              </div>
            </div>

            <div style={{ fontWeight: 900 }}>
              {fmtVND(r.paid_amount)}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
