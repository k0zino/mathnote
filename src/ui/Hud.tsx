import type { Stats } from '../ink/engine'

export function Hud({ stats }: { stats: Stats | null }) {
  if (!stats) return null

  return (
    <div className="hud">
      <div>
        <span>FPS</span>
        <b>{stats.fps}</b>
      </div>
      <div>
        <span>事件/秒</span>
        <b>{stats.eps}</b>
      </div>
      <div>
        <span>延迟</span>
        <b>{stats.latAvg > 0 ? `${stats.latAvg.toFixed(1)} ms` : '–'}</b>
      </div>
      <div>
        <span>p95</span>
        <b>{stats.latP95 > 0 ? `${stats.latP95.toFixed(1)} ms` : '–'}</b>
      </div>
      <div>
        <span>采样点</span>
        <b>{stats.points}</b>
      </div>
      <div className="pressure">
        <span>压感</span>
        <div className="bar">
          <i style={{ width: `${Math.round(stats.pressure * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
