import { useEffect, useRef, useState } from 'react'

/**
 * PV/UV 趋势折线：ECharts 按需引入（dynamic import），图表库只在看板真正渲染时加载。
 */
function TrendChart({ trend }) {
  const containerRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let chart = null
    let disposed = false
    let handleResize = null

    async function init() {
      try {
        const [core, { LineChart }, { GridComponent, TooltipComponent, LegendComponent }, { CanvasRenderer }] =
          await Promise.all([
            import('echarts/core'),
            import('echarts/charts'),
            import('echarts/components'),
            import('echarts/renderers'),
          ])
        core.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
        if (disposed || !containerRef.current) return
        chart = core.init(containerRef.current)
        chart.setOption({
          grid: { left: 44, right: 16, top: 36, bottom: 28 },
          legend: { data: ['PV', 'UV'], textStyle: { color: '#86868b', fontSize: 11 } },
          tooltip: { trigger: 'axis' },
          xAxis: {
            type: 'category',
            data: trend.map((t) => String(t.d).slice(5)),
            axisLabel: { color: '#86868b', fontSize: 10 },
            axisLine: { lineStyle: { color: '#e5e5ea' } },
          },
          yAxis: {
            type: 'value',
            axisLabel: { color: '#86868b', fontSize: 10 },
            splitLine: { lineStyle: { color: '#f0f0f4' } },
          },
          series: [
            {
              name: 'PV',
              type: 'line',
              smooth: true,
              showSymbol: false,
              data: trend.map((t) => t.pv),
              lineStyle: { width: 2, color: '#0a84ff' },
              itemStyle: { color: '#0a84ff' },
            },
            {
              name: 'UV',
              type: 'line',
              smooth: true,
              showSymbol: false,
              data: trend.map((t) => t.uv),
              lineStyle: { width: 2, color: '#8e8e93' },
              itemStyle: { color: '#8e8e93' },
            },
          ],
        })
        handleResize = () => chart && chart.resize()
        window.addEventListener('resize', handleResize)
      } catch {
        if (!disposed) setFailed(true)
      }
    }

    init()
    return () => {
      disposed = true
      if (handleResize) window.removeEventListener('resize', handleResize)
      if (chart) chart.dispose()
    }
  }, [trend])

  if (failed) return <p className="bg-hint">图表加载失败</p>
  return <div ref={containerRef} className="bg-chart" aria-label="访问趋势图" />
}

export default TrendChart
