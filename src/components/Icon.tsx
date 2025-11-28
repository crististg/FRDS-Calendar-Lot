import React from 'react'
import { HiCalendar, HiCog, HiUsers, HiPlus, HiMenu, HiChartBar } from 'react-icons/hi'

type IconName = 'calendar' | 'settings' | 'users' | 'plus' | 'menu' | 'stats'

const map: Record<IconName, React.ElementType> = {
  calendar: HiCalendar,
  settings: HiCog,
  users: HiUsers,
  plus: HiPlus,
  menu: HiMenu,
  stats: HiChartBar,
}

type Props = {
  name: IconName
  className?: string
  size?: number | string
}

export default function Icon({ name, className, size = 16 }: Props) {
  const C = map[name]
  if (!C) return null
  return <C className={className} size={size} />
}

export { map as iconMap }
