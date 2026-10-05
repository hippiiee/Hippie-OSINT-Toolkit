import { ImageResponse } from 'next/og'

export const alt = 'Hippie OSINT Toolkit (HOT) — Open-source intelligence tools and guides'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', height: '100%', padding: '80px', background: 'linear-gradient(135deg, #17102e, #312e81)', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', fontSize: 30, color: '#c4b5fd', marginBottom: 28 }}>HOT · Free &amp; open source</div>
      <div style={{ display: 'flex', fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>Hippie OSINT Toolkit</div>
      <div style={{ display: 'flex', fontSize: 32, color: '#e0e7ff', marginTop: 32 }}>Open-source intelligence tools and guides</div>
      <div style={{ display: 'flex', fontSize: 24, color: '#c4b5fd', marginTop: 48 }}>Domains · Images · Usernames · Social networks</div>
    </div>, size,
  )
}
