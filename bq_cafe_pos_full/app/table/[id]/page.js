'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const fmtVND = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

export default function TablePage({ params }) {
  const tableId = params?.id;
  const router = useRouter();

  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');

  // ===============================
  // Load table + open order
  // ===============================

  async function loadTable() {
    const { data, error } = await supabase
      .from('cafe_tables')
      .select('*')
      .eq('id', tableId)
      .single();

    if (error) throw error;
    setTable(data);
  }

  async function loadOpenOrder() {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'open')
      .limit(1);

    if (error) throw error;

    if (!data?.length) {
      setOrder(null);
      setOrderItems([]);
      await supabase
        .from('cafe_tables')
        .update({ status: 'empty' })
        .eq('id', tableId);
      return;
    }

    const openOrder = data[0];
    setOrder(openOrder);

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', openOrder.id);

    if (!items?.length) {
      // auto void nếu rỗng
      await supabase
        .from('orders')
        .update({ status: 'void' })
        .eq('id', openOrder.id);

      await supabase
        .from('cafe_tables')
        .update({ status: 'empty' })
        .eq('id', tableId);

      setOrder(null);
      setOrderItems([]);
      return;
    }

    setOrderItems(items);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadTable();
        await loadOpenOrder();
      } catch (e) {
        console.error(e);
        setErrMsg('Không tải được dữ liệu.');
      } finally {
        setLoading(false);
      }
    })();
  }, [tableId]);

  const subTotal = useMemo(
    () =>
      orderItems.reduce(
        (s, it) => s + Number(it.price) * Number(it.qty),
        0
      ),
    [orderItems]
  );

  if (loading) {
    return (
      <main style={{ padding: 20 }}>
        Đang tải...
      </main>
    );
  }

  return (
    <main style={{ padding: 20 }}>
      <h2>Bàn {table?.name}</h2>

      <button onClick={() => router.push('/')}>
        ← Về chọn bàn
      </button>

      {errMsg && (
        <div style={{ color: 'red', marginTop: 10 }}>
          {errMsg}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {orderItems.length === 0 ? (
          <div>Chưa có món nào.</div>
        ) : (
          orderItems.map((it) => (
            <div key={it.id} style={{ marginBottom: 10 }}>
              {it.item_name} × {it.qty} —{' '}
              {fmtVND(it.price * it.qty)}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 20, fontWeight: 900 }}>
        Tổng: {fmtVND(subTotal)}
      </div>
    </main>
  );
}
