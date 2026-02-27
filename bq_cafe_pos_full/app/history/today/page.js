'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function toDateKey(iso) {
  // iso: '2026-02-27T...'
  if (!iso) return 'unknown';
  return String(iso).slice(0, 10);
}

function fmtDateVN(key) {
  // key: YYYY-MM-DD
  if (!key || key === 'unknown') return 'Không rõ ngày';
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
}

function fmtTimeVN(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  return dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function HistoryTodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  const [payments, setPayments] = useState([]); // enriched with table_name

  async function loadLast7DaysPayments() {
    setErrMsg('');

    // ✅ chỉ lấy 7 ngày gần nhất (không xoá DB)
    const fromISO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1) load payments
    const { data: payData, error: payErr } = await supabase
      .from('payments')
      .select('id, created_at, order_id, method, sub_total, service_percent, service_amount, paid_amount')
      .gte('created_at', fromISO)
      .order('created_at', { ascending: false });

    if (payErr) throw payErr;

    const list = payData || [];

    // 2) fetch table_name from orders by order_id (robust hơn join)
    const orderIds = Array.from(new Set(list.map((x) => x.order_id).filter(Boolean)));
    let orderMap = {};

    if (orderIds.length) {
      const { data: orderData, error: oErr } = await supabase
        .from('orders')
        .select('id, table_name, table_id')
        .in('id', orderIds);

      if (oErr) {
        console.error('Load orders for payments error:', oErr);
      } else {
        (orderData || []).forEach((o) => {
          orderMap[o.id] = o;
        });
      }
    }

    const enriched = list.map((p) => ({
      ...p,
      table_name: orderMap[p.order_id]?.table_name || ''
    }));

    setPayments(enriched);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadLast7DaysPayments();
      } catch (e) {
        console.error('History load error:', e);
        if (alive) setErrMsg('Không tải được lịch sử thanh toán. Kiểm tra bảng payments / RLS policy.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // group by day
  const grouped = useMemo(() => {
    const g = {};
    for (const p of payments) {
      const key = toDateKey(p.created_at);
      if (!g[key]) g[key] = [];
      g[key].push(p);
    }
    // sort keys desc
    const keys = Object.keys(g).sort((a, b) => (a > b ? -1 : 1));
    return keys.map((k) => ({
      dayKey: k,
      rows: g[k] || []
    }));
  }, [payments]);

  const total7Days = useMemo(() => {
    return payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  }, [payments]);

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>Lịch sử thanh toán (7 ngày gần nhất)</h3>
          <div style={{ fontSize: 12, color: '#666' }}>
            Tổng 7 ngày: <strong>{fmtVND(total7Days)}</strong> • {payments.length} giao dịch
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/')}>Về chọn bàn</button>
          <button
            onClick={async () => {
              try {
                setLoading(true);
                await loadLast7DaysPayments();
              } catch (e) {
                console.error(e);
                setErrMsg('Không tải lại được.');
              } finally {
                setLoading(false);
              }
            }}
          >
            Tải lại
          </button>
        </div>
      </div>

      {errMsg && <div style={{ marginTop: 10, color: '#b00020' }}>{errMsg}</div>}

      {loading ? (
        <div style={{ marginTop: 12 }}>Đang tải...</div>
      ) : grouped.length === 0 ? (
        <div style={{ marginTop: 12, color: '#666' }}>Chưa có thanh toán trong 7 ngày gần nhất.</div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(({ dayKey, rows }) => {
            const dayTotal = rows.reduce((s, r) => s + Number(r.paid_amount || 0), 0);

            return (
              <section key={dayKey} style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 900 }}>{fmtDateVN(dayKey)}</div>
                  <div style={{ fontWeight: 900 }}>{fmtVND(dayTotal)}</div>
                </div>

                <div style={{ marginTop: 10, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Giờ</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Bàn</th>
                        <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Phương thức</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Tạm tính</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Phí DV</th>
                        <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid #eee' }}>Thanh toán</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0', whiteSpace: 'nowrap' }}>
                            {fmtTimeVN(p.created_at)}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0' }}>
                            {p.table_name ? `Bàn ${p.table_name}` : '-'}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0' }}>
                            {p.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0', textAlign: 'right' }}>
                            {fmtVND(p.sub_total)}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0', textAlign: 'right' }}>
                            {fmtVND(p.service_amount)}
                          </td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px dashed #f0f0f0', textAlign: 'right', fontWeight: 900 }}>
                            {fmtVND(p.paid_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Gợi ý: Trang này chỉ <strong>hiển thị</strong> 7 ngày gần nhất (không xoá dữ liệu trong DB).
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
