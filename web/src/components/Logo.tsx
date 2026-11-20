import { LOGO } from '../config'

export function Logo() {
  return (
    <div className="logo-box">
      <a href={LOGO.href} target="_blank" rel="noopener noreferrer">
        <img className="logo" src={LOGO.src} alt={LOGO.alt} />
      </a>
    </div>
  )
}
