import { BarChart, HeatmapChart, LineChart } from "echarts/charts"
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components"
import { init, use } from "echarts/core"
import { CanvasRenderer } from "echarts/renderers"

/**
 * Only the parts of ECharts the Obsar figures use, so the island's bundle
 * stays a fraction of the whole library. Imported by the islands on demand.
 */
use([
  BarChart,
  HeatmapChart,
  LineChart,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { init }
