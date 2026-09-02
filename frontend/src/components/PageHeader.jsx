export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-8">{actions}</div>}
    </div>
  )
}
