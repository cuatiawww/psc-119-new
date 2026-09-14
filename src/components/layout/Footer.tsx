'use client'

import { Globe2, Mail, MessageCircle } from 'lucide-react'

const contactLinks = [
  {
    label: 'Instagram Kemenkes RI',
    href: 'https://www.instagram.com/kemenkes_ri',
    icon: 'instagram',
  },
  {
    label: 'YouTube Kemenkes RI',
    href: 'https://www.youtube.com/KementerianKesehatanRI',
    icon: 'youtube',
  },
  {
    label: 'WhatsApp Kemenkes RI',
    href: 'https://wa.me/628111500567',
    icon: MessageCircle,
  },
  {
    label: 'Email Kemenkes RI',
    href: 'mailto:kontak@kemkes.go.id',
    icon: Mail,
  },
  {
    label: 'Website Kemenkes RI',
    href: 'https://kemkes.go.id',
    icon: Globe2,
  },
]

function BrandIcon({ name }: { name: string }) {
  if (name === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="border-t border-teal-100 bg-white" role="contentinfo">
      <div className="h-1 bg-gradient-to-r from-[#0f8f96] via-[#25c2b8] to-transparent" />
      <div className="flex min-h-16 w-full flex-col items-center justify-between gap-3 px-4 py-3 sm:px-6 md:flex-row">
        <p className="text-center text-xs text-slate-500 md:text-left">
          © 2026 Kementerian Kesehatan Republik Indonesia. All rights reserved.
        </p>

        <nav aria-label="Kontak dan media sosial Kemenkes RI">
          <ul className="flex items-center gap-1.5" role="list">
            {contactLinks.map((item) => {
              const Icon = item.icon

              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    aria-label={item.label}
                    title={item.label}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-100 bg-teal-50/70 text-[#0f8f96] transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-[#0f8f96] hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-300"
                  >
                    {typeof Icon === 'string' ? <BrandIcon name={Icon} /> : <Icon className="h-4 w-4" />}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
