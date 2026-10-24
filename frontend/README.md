This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Menjalankan lokal (RadarIsu)

- Untuk bekerja sehari-hari pakai `npm run dev`. Server dev memakai folder terpisah dari hasil build, jadi aman bila `npm run build` dijalankan di sela-selanya.
- `npm start` (`node server.mjs`) menjalankan hasil `npm run build`. **Jangan menjalankan `npm run build` selagi `npm start` aktif.** Build mengganti isi `.next`, sehingga server yang berjalan masih menyebut file JS/CSS lama yang sudah hilang (500), halaman tidak ter-hydrate, dan tombol serta form tidak berfungsi.
- Sejak ada penjaga di `server.mjs`, server produksi keluar sendiri dengan pesan `.next was rebuilt ... exiting` begitu build berganti. Jalankan `npm start` lagi setelah build selesai.
- Di Docker hal ini tidak terjadi: build terjadi saat image dibuat, bukan saat kontainer berjalan.
- Form login memakai `method="post"` dan baru aktif setelah halaman ter-hydrate. Kalau form tampak nonaktif terus, JavaScript halaman gagal dimuat: periksa tab Network untuk respons 4xx/5xx pada `/_next/static/...`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
