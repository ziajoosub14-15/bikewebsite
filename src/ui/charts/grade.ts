/** Diverging gradient colours: blues downhill, neutral flat, oranges to deep red uphill. */
export const GRADE_BUCKETS = [
  { max: -8, color: '#1f5fae', label: '< −8%' },
  { max: -4, color: '#2a78d6', label: '−8 to −4%' },
  { max: -2, color: '#93b8e8', label: '−4 to −2%' },
  { max: 2, color: '#cbc9c2', label: '−2 to 2%' },
  { max: 4, color: '#f2b48f', label: '2–4%' },
  { max: 6, color: '#eb6834', label: '4–6%' },
  { max: 9, color: '#c94a1c', label: '6–9%' },
  { max: Infinity, color: '#86290c', label: '> 9%' },
];

export function gradeColor(g: number): string {
  return (GRADE_BUCKETS.find((b) => g < b.max) ?? GRADE_BUCKETS[GRADE_BUCKETS.length - 1]).color;
}
