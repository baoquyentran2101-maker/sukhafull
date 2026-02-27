'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function isValidDateKey(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
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

function shortId(id) {
  const s = String(id || '');
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export default function HistoryByDatePage({ params }) {
  const router = useRouter();
  const dateKey = params?.date;

  const [payments, setPayments] = useState([]);
  const [ordersMap, setOrdersMap] = useState(new Map()); // order_id -> table_name
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  const total = useMemo(
    () => payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0),
    [payments]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErrMsg('');

        if (!isValidDateKey(dateKey)) {
          setErrMsg('Link ngày không đúng. Ví dụ đúng: /history/2026-02-27');
          setPayments([]);
          return;
        }

        const { startISO, endISO } = localDayRangeToISO(dateKey);

        // 1) lấy payments theo ngày
        const { data, error } = await supabase
          .from('payments')
          .select('id, created_at, order_id, method, sub_total, service_percent, service_amount, paid_amount')
          .gte('created_at', startISO)
          .lt('created_at', endISO)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const list = data || [];
        setPayments(list);

        // 2) lấy table_name từ orders (không cần relationship trong Supabase)
        const orderIds = Array.from(new Set(list.map((x) => x.order_id).filter(Boolean)));
        if (orderIds.length) {
          const { data: os, error: oErr } = await supabase
            .from('orders')
            .select('id, table_name')
            .in('id', orderIds);

          if (!oErr && os?.length) {
            const m = new Map();
            for (const o of os) m.set(o.id, o.table_name || '');
            setOrdersMap(m);
          } else {
            setOrdersMap(new Map());
          }
        } else {
          setOrdersMap(new Map());
        }
      } catch (e) {
        console.error('HistoryByDatePage load error:', e);
        setErrMsg('Không tải được lịch sử ngày này. Kiểm tra bảng payments có cột created_at.');
        setPayments([]);
        setOrdersMap(new Map());
      } finally {
        setLoading(false);
      }
    })();
  }, [dateKey]);

  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Lịch sử: {isValidDateKey(dateKey) ? formatVNDate(dateKey) : String(dateKey || '')}</h3>
          <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
            Tổng: <b>{fmtVND(total)}</b> • {payments.length} hoá đơn
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/history/today')}>Chọn ngày</button>
          <button onClick={() => router.push('/')}>Về chọn bàn</button>
        </div>
      </div>

      {errMsg && <div style={{ marginTop: 10, color: '#b00020', fontSize: 13 }}>{errMsg}</div>}

      {loading ? (
        <div style={{ marginTop: 12 }}>Đang tải...</div>
      ) : payments.length === 0 ? (
        <div style={{ marginTop: 12 }}>Không có thanh toán trong ngày này.</div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {payments.map((p) => {
            const timeVN = new Date(p.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            const tableName = ordersMap.get(p.order_id) || '';

            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 900 }}>
                    {tableName ? `Bàn ${tableName}` : `Order ${shortId(p.order_id)}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>{timeVN}</div>
                </div>

                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, color: '#444' }}>
                    {p.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                    {Number(p.service_amount || 0) > 0 ? ` • Phí DV ${p.service_percent || 0}%` : ''}
                  </div>
                  <div style={{ fontWeight: 900 }}>{fmtVND(p.paid_amount)}</div>
                </div>

                <div style={{ marginTop: 6, fontSize: 12, color: '#777' }}>
                  Tạm tính: {fmtVND(p.sub_total)} • Phí DV: {fmtVND(p.service_amount)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
