import type { SVGProps } from 'react'

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={props.width ?? 20}
      height={props.height ?? 20}
      {...props}
    />
  )
}

export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Icon>
  )
}

export function ScanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </Icon>
  )
}

export function SeriesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Icon>
  )
}

export function HeartIcon(props: SVGProps<SVGSVGElement> & { filled?: boolean }) {
  const { filled, ...rest } = props
  return (
    <Icon fill={filled ? 'currentColor' : 'none'} {...rest}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </Icon>
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Icon>
  )
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  )
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2.4} {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </Icon>
  )
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2} {...props}>
      <polyline points="15 18 9 12 15 6" />
    </Icon>
  )
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </Icon>
  )
}
