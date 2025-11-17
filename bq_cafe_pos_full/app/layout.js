export const metadata = {
  title: 'BQ Café POS',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          background: '#f5f5f5'
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            minHeight: '100vh',
            background: '#fff',
            boxShadow: '0 0 10px rgba(0,0,0,0.06)'
          }}
        >
          <header
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h2 style={{ margin: 0 }}>BQ Café POS</h2>
            <small>Demo chạy bằng Next.js + Supabase</small>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
