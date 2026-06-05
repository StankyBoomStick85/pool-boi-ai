import { NavLink } from 'react-router-dom'

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function DropletIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-3.31 4.5-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-2.69-6.5-6-11z" />
    </svg>
  )
}

function BeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M9 3v7L5 19h14L15 10V3" />
      <path d="M6.5 16h11" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

const navItems = [
  { to: '/', end: true, icon: <HomeIcon />, label: 'Home' },
  { to: '/test', icon: <DropletIcon />, label: 'Test' },
  { to: '/inventory', icon: <BeakerIcon />, label: 'Shelf' },
  { to: '/history', icon: <ClockIcon />, label: 'History' },
]

export default function PoolBoiNav() {
  return (
    <nav className="pb-nav">
      {navItems.map(({ to, end, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `pb-nav-item${isActive ? ' active' : ''}`}
        >
          {icon}
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
