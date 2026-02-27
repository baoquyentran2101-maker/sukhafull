'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function toDateKeyLocal(d) {
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

// Local day range => ISO (UTC) để query timestamptz chuẩn
function localDayRangeToISO(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

export default function HistoryTodayPage() {
  const router = useRouter();

  const [rows, setRows] = useState([]); // payments 7 ngày
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  const days = useMemo(() => {
    // tạo list 7 ngày gần nhất (local)
    const out = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      out.push(toDateKeyLocal(d));
    }
    return out; // [today, yesterday, ...]
  }, []);

  const statsByDay = useMemo(() => {
    // group payments theo ngày local
    const map = new Map();
    for (const r of rows) {
      const key = toDateKeyLocal(r.created_at);
      const prev = map.get(key) || { count: 0, total: 0 };
      prev.count += 1;
      prev.total += Number(r.paid_amount || 0);
      map.set(key, prev);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrMsg('');

        // Query payments cho 7 ngày gần nhất: từ đầu ngày (today-6) đến đầu ngày (tomorrow)
        const oldestKey = days[days.length - 1];
        const newestKey = days[0];

        const { startISO: startOldest } = localDayRangeToISO(oldestKey);
        const { endISO: endNewest } = localDayRangeToISO(newestKey);

        const { data, error } = await supabase
          .from('payments')
          .select('id, created_at, paid_amount')
          .gte('created_at', startOldest)
          .lt('created_at', endNewest)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRows(data || []);
      } catch (e) {
        console.error('HistoryTodayPage load error:', e);
        setErrMsg('Không tải được lịch sử. Kiểm tra bảng payments có cột created_at.');
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Lịch sử thanh toán</h3>
        <div>Đang tải...</div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Lịch sử thanh toán</h3>
        <button onClick={() => router.push('/')}>Về chọn bàn</button>
      </div>

      {errMsg && <div style={{ marginTop: 10, color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {days.map((dateKey) => {
          const stat = statsByDay.get(dateKey) || { count: 0, total: 0 };
          return (
            <button
              key={dateKey}
              onClick={() => router.push(`/history/${dateKey}`)}
              style={{
                padding: 14,
                borderRadius: 12,
                border: '1px solid #ddd',
                textAlign: 'left',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 900 }}>{formatVNDate(dateKey)}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
                {stat.count} hoá đơn • Tổng: <b>{fmtVND(stat.total)}</b>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#777' }}>Mở chi tiết</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Danh sách mặc định hiển thị 7 ngày gần nhất (theo giờ máy bạn).
      </div>
    </main>
  );
}
