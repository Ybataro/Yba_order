/**
 * 根據店家排序設定，建立「分類 → 排序後品項」的 Map。
 * sortCategories / sortItems 由 useStoreSortOrder hook 提供。
 */
export function buildSortedByCategory<T extends { id: string; category: string }>(
  categories: string[],
  items: T[],
  sortCategories: (cats: string[]) => string[],
  sortItems: <U extends { id: string }>(items: U[]) => U[],
): Map<string, T[]> {
  const sorted = sortCategories(categories)
  const map = new Map<string, T[]>()
  for (const cat of sorted) {
    const catItems = items.filter((i) => i.category === cat)
    map.set(cat, sortItems(catItems))
  }
  return map
}
