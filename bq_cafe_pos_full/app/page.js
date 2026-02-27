'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const router = useRouter();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  async function loadTables() {
    setErrMsg('');

    // ✅ Lấy thêm area để render phân khu (chỉ thay đổi hiển thị)
    // Nếu relationship không tên "areas", code vẫn fallback về "Chưa phân khu".
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('id, name, status, area_id, areas(name)')
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setErrMsg('Không tải được danh sách bàn.');
      return;
    }

    setTables(data || []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrMsg('');
      await loadTables();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inUseTables = useMemo(() => tables.filter((t) => t.status === 'in_use'), [tables]);

  // ✅ Group theo khu vực (fallback nếu thiếu area)
  const tablesByArea = useMemo(() => {
    const buckets = new Map();

    for (const t of tables) {
      const areaName =
        (t?.areas && t.areas.name) ||
        t?.area_name ||
        t?.area ||
        'Chưa phân khu';

      if (!buckets.has(areaName)) buckets.set(areaName, []);
      buckets.get(areaName).push(t);
    }

    // sort tables trong từng khu theo name
    for (const [k, list] of buckets.entries()) {
      list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'vi'));
      buckets.set(k, list);
    }

    // sort khu theo tên (để UI ổn định)
    return Array.from(buckets.entries()).sort(([a], [b]) => String(a).localeCompare(String(b), 'vi'));
  }, [tables]);

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        <div>Đang tải...</div>
      </main>
    );
  }

  const SmallDot = ({ color = '#d32f2f' }) => (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        marginRight: 8,
        verticalAlign: 'middle'
      }}
    />
  );

  return (
    <main style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>BQ Café POS</h2>
          <div style={{ fontSize: 12, color: '#666' }}>Dashboard</div>
        </div>

        {/* ✅ Giữ nguyên 4 nút */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => router.push('/menu')}>Quản lý menu</button>
          <button onClick={() => router.push('/areas')}>Khu vực</button>
          <button onClick={() => router.push('/history')}>Lịch sử thanh toán</button>
          <button onClick={loadTables}>Tải lại</button>
        </div>
      </div>

      {errMsg && <div style={{ color: '#b00020', marginTop: 10 }}>{errMsg}</div>}

      {/* ======================
          Bàn đang sử dụng
          ====================== */}
      <section style={{ marginTop: 18 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Bàn đang sử dụng</h3>

        {inUseTables.length === 0 ? (
          <div style={{ color: '#666' }}>Không có bàn nào đang sử dụng.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12
            }}
          >
            {inUseTables.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/table/${t.id}`)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid #f3c2c2',
                  background: '#ffe0e0',
                  fontWeight: 800,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {/* ✅ icon nhỏ hơn */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <SmallDot color="#d32f2f" />
                  <div>Bàn {t.name}</div>
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: '#7a1c1c' }}>Đang sử dụng</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ======================
          Tất cả bàn (phân khu)
          ====================== */}
      <section style={{ marginTop: 22 }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Tất cả bàn</h3>

        {tablesByArea.length === 0 ? (
          <div style={{ color: '#666' }}>Chưa có dữ liệu bàn.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {tablesByArea.map(([areaName, list]) => (
              <div
                key={areaName}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 14,
                  padding: 12,
                  background: '#fff'
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
                  Khu: {areaName}
                  <span style={{ fontWeight: 600, color: '#666', marginLeft: 8, fontSize: 12 }}>
                    ({list.length})
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 12
                  }}
                >
                  {list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/table/${t.id}`)}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: '1px solid #ddd',
                        background: t.status === 'in_use' ? '#ffe0e0' : '#e8f5e9',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.status === 'in_use' ? <SmallDot color="#d32f2f" /> : <SmallDot color="#2e7d32" />}
                        <div>Bàn {t.name}</div>
                      </div>

                      <div style={{ fontSize: 12, marginTop: 6, color: '#555' }}>
                        {t.status === 'in_use' ? 'Đang sử dụng' : 'Trống'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
