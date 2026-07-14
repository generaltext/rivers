// Small shared UI primitives, kept lightweight and theme-token driven.

import type { ReactNode } from 'react'

export function ColorDot({ color, size = 10, ring = false }: { color: string; size?: number; ring?: boolean }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: ring ? `0 0 0 2px var(--color-panel), 0 0 0 3.5px ${color}` : `0 0 4px ${color}`,
      }}
    />
  )
}

export function Button({
  children,
  onClick,
  variant = 'default',
  type = 'button',
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'accent' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
}) {
  const styles: Record<string, string> = {
    default: 'border border-line2 text-fg2 hover:bg-panel-2',
    accent: 'bg-accent text-accent-fg hover:opacity-90',
    ghost: 'text-fg3 hover:bg-panel-2 hover:text-fg',
    danger: 'text-bad hover:bg-[color:var(--color-bad)]/10',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${styles[variant]}`}
    >
      {children}
    </button>
  )
}

export function IconButton({
  children,
  onClick,
  label,
  active = false,
}: {
  children: ReactNode
  onClick?: () => void
  label: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-accent-tint text-accent' : 'text-fg3 hover:bg-panel-2 hover:text-fg'
      }`}
    >
      {children}
    </button>
  )
}
