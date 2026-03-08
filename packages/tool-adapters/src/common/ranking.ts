export function assignDeterministicRanks<T>(items: T[]): Array<T & { rank: number }> {
  return items.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}
