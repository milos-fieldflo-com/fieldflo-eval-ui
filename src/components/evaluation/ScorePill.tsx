import { scoreColor } from '../../utils/colors'

interface ScorePillProps {
  score: number | null
}

export function ScorePill({ score }: ScorePillProps) {
  if (score === null) {
    return <span className="score-pill score-pill-na">N/A</span>
  }

  const bg = scoreColor(score)
  const textColor = score >= 3 ? '#000' : '#fff'

  return (
    <span
      className="score-pill"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {score}
    </span>
  )
}
