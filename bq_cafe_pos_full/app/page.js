'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

export default function TablePage({ params }) {
  const tableId = params.id;
  const router = useRouter();

  // ===== DATA =====
  const [table, setTable] = useState(null);
  const [order, setOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  // ===== POS =====
  const [serviceEnabled, setServiceEnabled] = useState(true);
  const [servicePercent, setServicePercent] = useState(5);
  const [payMethod, setPayMethod] = useState('cash');
  const [paying, setPaying] = useState(false);

  // ---------- LOAD ----------
  async function loadOpenOrder() {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', tableId)
      .eq('status', 'open')
      .limit(1);

    if (data?.length) {
      setOrder(data[0]);
      loadOrderItems(data[0].id);
    }
  }

  async function loadOrderItems(orderId) {
    const { data } = await supabase
      .from('order_items')
      .select('id, item_name, price, qty')
      .eq('order_id', orderId);

    setOrderItems(data || []);
  }

  useEffect(() => {
    loadOpenOrder();
  }, []);

  // ---------- CALC ----------
  const subTotal = useMemo(() => {
    return orderItems.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  }, [orderItems]);

  const serviceAmount = useMemo(() => {
    if (!serviceEnabled) return 0;
    return Math.round((subTotal * Number(servicePercent || 0)) / 100);
  }, [subTotal, serviceEnabled, servicePercent]);

  const finalTotal = useMemo(() => {
    return subTotal + serviceAmount;
  }, [subTotal, serviceAmount]);

  // ---------- PAY ----------
  async function handlePay() {
    if (!order || finalTotal <= 0) return;

    setPaying(true);

    await supabase.from('payments').insert({
      order_id: order.id,
      method: payMethod,
      sub_total: subTotal,
      service_percent: serviceEnabled ? Number(servicePercent) : 0,
      service_amount: serviceAmount,
      paid_amount: finalTotal
    });

    await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id);
    await supabase.from('cafe_tables').update({ status: 'empty' }).eq('id', tableId);

    setPaying(false);
    router.push('/history/today');
  }

  // ---------- UI ----------
  return (
    <main style={{ padding: 16 }}>
      <h3>Order</h3>

      {/* Order list */}
      <div style={{ marginBottom: 20 }}>
        {orderItems.map((it) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>{it.item_name} x{it.qty}</div>
            <div>{(it.price * it.qty).toLocaleString('vi-VN')} đ</div>
          </div>
        ))}
      </div>

      {/* POS BREAKDOWN */}
      <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <strong>Tạm tính</strong>
          <strong>{subTotal.toLocaleString('vi-VN')} đ</strong>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={serviceEnabled}
            onChange={(e) => setServiceEnabled(e.target.checked)}
          />
          <span style={{ marginLeft: 6 }}>Phí dịch vụ</span>

          {serviceEnabled && (
            <input
              type="number"
              value={servicePercent}
              onChange={(e) => setServicePercent(e.target.value)}
              style={{ width: 60, marginLeft: 10 }}
            />
          )}
          {serviceEnabled && <span>%</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div>Phí dịch vụ</div>
          <div>{serviceAmount.toLocaleString('vi-VN')} đ</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <strong>Tổng thanh toán</strong>
          <strong>{finalTotal.toLocaleString('vi-VN')} đ</strong>
        </div>

        <div style={{ marginTop: 12 }}>
          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            <option value="cash">Tiền mặt</option>
            <option value="transfer">Chuyển khoản</option>
          </select>

          <button
            onClick={handlePay}
            disabled={paying}
            style={{ marginLeft: 10 }}
          >
            {paying ? 'Đang thanh toán...' : 'Thanh toán'}
          </button>
        </div>
      </div>
    </main>
  );
}
