import type { ReactNode, SVGProps } from "react";

export type AppIconName = "home" | "gacha" | "team" | "dex" | "market" | "calendar" | "mission" | "megaphone";

const iconPaths: Record<AppIconName, ReactNode> = {
  home: (
    <>
      <path d="M4 15 16 5l12 10v14H8V18h8v11h8V15" />
      <path d="M11 29V17h10v12" className="app-icon-accent" />
    </>
  ),
  gacha: (
    <>
      <path d="M16 4 27 13 22 28H10L5 13Z" />
      <path d="M11 13h10M9 18h14M13 23h6" className="app-icon-accent" />
    </>
  ),
  team: (
    <>
      <path d="M16 4 27 9v8c0 7-5 11-11 13C10 28 5 24 5 17V9Z" />
      <path d="M16 10v14M10 16h12M11 22h10" className="app-icon-accent" />
    </>
  ),
  dex: (
    <>
      <path d="M7 5h9c3 0 5 2 5 5v19H10c-2 0-3-1-3-3Z" />
      <path d="M21 5h4v24h-4M12 12h5M12 17h5M12 22h5" className="app-icon-accent" />
    </>
  ),
  market: (
    <>
      <path d="M5 27h22" />
      <path d="M8 24v-6h4v6M15 24V12h4v12M22 24V7h4v17" />
      <path d="M7 14 13 10l5 3 8-8" className="app-icon-accent" />
    </>
  ),
  calendar: (
    <>
      <path d="M7 7h18v21H7Z" />
      <path d="M11 4v6M21 4v6M7 13h18M11 21l3 3 7-8" className="app-icon-accent" />
    </>
  ),
  mission: (
    <>
      <path d="M8 6h14l3 4v18H8Z" />
      <path d="M22 6v5h5M12 14h8M12 19h10M12 24h7" className="app-icon-accent" />
    </>
  ),
  megaphone: (
    <>
      <path d="M5 18h5l14-8v16l-14-8" />
      <path d="M10 18v7h5l-2-6M25 13l3-3M26 19h4M25 25l3 3" className="app-icon-accent" />
    </>
  )
};

export function AppIcon({ name, className = "", ...props }: { name: AppIconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={`app-icon ${className}`.trim()}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth="2.4"
      shapeRendering="crispEdges"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
