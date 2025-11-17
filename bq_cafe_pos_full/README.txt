BQ Café POS – Full Code

1. Tạo project Supabase mới, mở SQL editor, COPY toàn bộ file schema.sql và RUN 1 lần.
   -> Sẽ tạo bảng + dữ liệu mẫu (khu A-D + Mang về, bàn, menu).

2. Clone project này (hoặc upload zip lên GitHub), sau đó:
   npm install
   tạo file .env.local ở thư mục gốc với 2 dòng:
     NEXT_PUBLIC_SUPABASE_URL=...
     NEXT_PUBLIC_SUPABASE_ANON_KEY=...

3. Chạy local:
   npm run dev
   -> http://localhost:3000

4. Deploy lên Vercel:
   - Import repo từ GitHub
   - Framework: Next.js (mặc định)
   - Root Directory: để trống (vì package.json nằm ở gốc)
   - Environment variables: giống file .env.local
   - Deploy.
