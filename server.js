const express = require('express');
const cors = require('cors');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const Chart = require('chart.js');
const annotationPlugin = require('chartjs-plugin-annotation');
const datalabelsPlugin = require('chartjs-plugin-datalabels');
require('chartjs-adapter-date-fns');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

Chart.Chart.register(annotationPlugin);

const canvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 680,
  backgroundColour: 'white',
  chartCallback: (ChartJS) => {
    ChartJS.defaults.font.family = "'Helvetica Neue', 'Arial', sans-serif";
    ChartJS.defaults.font.size = 12;
    ChartJS.defaults.color = '#374151';
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.post('/render', async (req, res) => {
  try {
    const { config, width, height } = req.body || {};
    if (!config || !config.type) {
      return res.status(400).json({ error: 'Missing config.type in body' });
    }

    const usesDatalabels = !!(config.options?.plugins?.datalabels);
    const pluginInstances = usesDatalabels ? [datalabelsPlugin] : [];

    const renderCanvas = (width || height)
      ? new ChartJSNodeCanvas({
          width: width || 1200,
          height: height || 680,
          backgroundColour: 'white',
          chartCallback: (ChartJS) => {
            ChartJS.defaults.font.family = "'Helvetica Neue', 'Arial', sans-serif";
            ChartJS.defaults.font.size = 12;
            ChartJS.defaults.color = '#374151';
          }
        })
      : canvas;

    const image = await renderCanvas.renderToBuffer(
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