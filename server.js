const express = require('express');
const cors = require('cors');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const Chart = require('chart.js');
const annotationPlugin = require('chartjs-plugin-annotation');
const datalabelsPlugin = require('chartjs-plugin-datalabels');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

Chart.Chart.register(annotationPlugin);

function buildCanvas(width, height) {
  return new ChartJSNodeCanvas({
    width: width || 1200,
    height: height || 680,
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
      ChartJS.defaults.font.family = "'Helvetica Neue', 'Arial', sans-serif";
      ChartJS.defaults.font.size = 12;
      ChartJS.defaults.color = '#374151';
    }
  });
}

// Rehydrate function-based options that JSON strips.
// The incoming config has `options.plugins.datalabels` as a plain object.
// If it contains a magic marker mode, we replace it with real functions here.
function rehydrateDatalabels(config) {
  const dl = config?.options?.plugins?.datalabels;
  if (!dl) return;

  // mode "series_end_label" = show each series' label at the last data point only
  if (dl.mode === 'series_end_label') {
    dl.display = function (ctx) {
      return ctx.dataIndex === ctx.chart.data.labels.length - 1;
    };
    dl.formatter = function (_value, ctx) { return ctx.dataset.label; };
    dl.color = function (ctx) { return ctx.dataset.borderColor || '#374151'; };
    dl.align = dl.align || 'right';
    dl.anchor = dl.anchor || 'end';
    dl.offset = dl.offset != null ? dl.offset : 8;
    dl.clamp = dl.clamp != null ? dl.clamp : true;
    if (!dl.font) dl.font = { size: 12, weight: '600' };
    delete dl.mode;
  } else {
    // If mode not set, disable datalabels entirely rather than letting it
    // draw a number on every single point.
    config.options.plugins.datalabels = { display: false };
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.1.0' });
});

app.post('/render', async (req, res) => {
  try {
    const { config, width, height } = req.body || {};
    if (!config || !config.type) {
      return res.status(400).json({ error: 'Missing config.type in body' });
    }

    const usesDatalabels = !!(config.options?.plugins?.datalabels);
    if (usesDatalabels) rehydrateDatalabels(config);

    const pluginInstances = usesDatalabels ? [datalabelsPlugin] : [];
    const canvas = buildCanvas(width, height);

    const image = await canvas.renderToBuffer(
      { ...config, plugins: pluginInstances },
      'image/png'
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(image);
  } catch (err) {
    console.error('Render error:', err);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`chart-renderer listening on ${port}`));