import { OUTCOMES, circleCounts } from "./outcomes";

/** 100 circles colored in proportion to each outcome's odds, read row by row. */
export function CircleGrid({ odds, className = "w-56 shrink-0" }: { odds: number[]; className?: string }) {
  const colors = circleCounts(odds).flatMap((n, i) => Array<string>(n).fill(OUTCOMES[i].color));
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`100 simulations: ${OUTCOMES.map((o, i) => `${o.label} ${circleCounts(odds)[i]}`).join(", ")}`}
    >
      {colors.map((c, k) => (
        <circle key={k} cx={5 + (k % 10) * 10} cy={5 + Math.floor(k / 10) * 10} r={4.1} fill={c} />
      ))}
    </svg>
  );
}
