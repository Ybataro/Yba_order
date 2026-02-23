interface GroupTabsProps {
  groups: { id: string; label: string }[]
  activeGroup: string
  onChange: (groupId: string) => void
}

export function GroupTabs({ groups, activeGroup, onChange }: GroupTabsProps) {
  return (
    <div className="flex gap-1 px-4 py-2 bg-white border-b border-gray-100">
      {groups.map((g) => (
        <button
          key={g.id}
          onClick={() => onChange(g.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeGroup === g.id
              ? 'bg-brand-oak text-white'
              : 'bg-gray-100 text-brand-mocha hover:bg-gray-200'
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}
