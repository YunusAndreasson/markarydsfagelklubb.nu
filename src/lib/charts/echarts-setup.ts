import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts"
import {
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components"
import { init, use } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"

/**
 * Only the parts of ECharts the Obsar figures use, so the chunk stays a
 * fraction of the whole library. Imported on demand by the figures' script
 * (`obsar-chart.client.ts`) and Ligan's race, once each nears the screen.
 */
use([
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { init }
