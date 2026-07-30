type NavMenuItemProps = {
  href: string
  label: string
  isActive: boolean
  onClick: () => void
}

export default function NavMenuItem({
  href,
  label,
  isActive,
  onClick,
}: NavMenuItemProps) {
  return (
    <a
      href={href}
      className="nav-menu-item"
      data-active={isActive ? "true" : "false"}
      aria-current={isActive ? "page" : undefined}
      data-sound="navigate"
      onClick={onClick}
    >
      {label}
    </a>
  )
}
