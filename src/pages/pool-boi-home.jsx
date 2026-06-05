import { Link } from 'react-router-dom'

function DropletIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-3.31 4.5-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-2.69-6.5-6-11z" />
    </svg>
  )
}

function BeakerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6" />
      <path d="M9 3v7L5 19h14L15 10V3" />
      <path d="M6.5 16h11" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

const cards = [
  {
    icon: <DropletIcon />,
    title: 'Test My Water',
    description: 'Read test strip and get treatment plan',
    route: '/test',
  },
  {
    icon: <BeakerIcon />,
    title: 'My Chemical Shelf',
    description: 'View and update your inventory',
    route: '/inventory',
  },
  {
    icon: <ClockIcon />,
    title: 'Treatment History',
    description: 'Past treatments and results',
    route: '/history',
  },
  {
    icon: <GearIcon />,
    title: 'Pool Settings',
    description: 'Pool specs and preferences',
    route: '/settings',
  },
]

export default function PoolBoiHome() {
  return (
    <div className="pb-page">
      <header className="pb-home-header">
        <h1 className="pb-app-title">Pool Boi AI</h1>
        <p className="pb-pool-specs">18,000 gal · Vinyl · Sand Filter</p>
      </header>
      <div className="pb-card-grid">
        {cards.map(card => (
          <Link key={card.route} to={card.route} className="pb-nav-card">
            <div className="pb-nav-card-icon">{card.icon}</div>
            <div>
              <h2 className="pb-nav-card-title">{card.title}</h2>
              <p className="pb-nav-card-desc">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
