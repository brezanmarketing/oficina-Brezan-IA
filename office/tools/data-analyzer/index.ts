import { writeFile } from '../file-manager/index';
import { chromium } from 'playwright';

export interface AnalysisResult {
    stats: Record<string, DescriptiveStats>;
    nullCount: Record<string, number>;
    correlations: Record<string, number>;
    categoricalDistribution: Record<string, Record<string, number>>;
}

export interface DescriptiveStats {
    mean: number;
    median: number;
    std: number;
    q1: number;
    q3: number;
    min: number;
    max: number;
}

export interface Anomaly {
    row: number;
    value: any;
    reason: string;
}

export interface DataSummary {
    rows: number;
    columns: number;
    columnsTypes: Record<string, string>;
}

export interface ChartFile {
    url: string;
    path: string;
}

function parseCSV(csvText: string): any[] {
    const lines = csvText.trim().split('\\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const obj: any = {};
            for (let j = 0; j < headers.length; j++) {
                let val = values[j].trim();
                // Convert numbers if possible
                if (val !== '' && !isNaN(Number(val))) {
                    obj[headers[j]] = Number(val);
                } else {
                    obj[headers[j]] = val;
                }
            }
            data.push(obj);
        }
    }
    return data;
}

function calculateMedian(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStats(arr: number[]): DescriptiveStats {
    if (arr.length === 0) return { mean: 0, median: 0, std: 0, q1: 0, q3: 0, min: 0, max: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const sum = arr.reduce((acc, val) => acc + val, 0);
    const mean = sum / arr.length;
    const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
    const std = Math.sqrt(variance);

    const mid = Math.floor(sorted.length / 2);
    const q1Arr = sorted.slice(0, mid);
    const q3Arr = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

    return {
        mean,
        median: calculateMedian(sorted),
        std,
        q1: calculateMedian(q1Arr),
        q3: calculateMedian(q3Arr),
        min: sorted[0],
        max: sorted[sorted.length - 1]
    };
}

export async function analyzeJSON(data: any[]): Promise<AnalysisResult> {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Data debe ser un array no vacío');
    }

    const columns = Object.keys(data[0]);
    const nullCount: Record<string, number> = {};
    const categoricalDistribution: Record<string, Record<string, number>> = {};
    const numericData: Record<string, number[]> = {};

    // Inicializar
    columns.forEach(col => {
        nullCount[col] = 0;
        categoricalDistribution[col] = {};
        numericData[col] = [];
    });

    data.forEach((row) => {
        columns.forEach(col => {
            const val = row[col];
            if (val === null || val === undefined || val === '') {
                nullCount[col]++;
            } else if (typeof val === 'number') {
                numericData[col].push(val);
            } else {
                const strVal = String(val);
                if (!categoricalDistribution[col][strVal]) {
                    categoricalDistribution[col][strVal] = 0;
                }
                categoricalDistribution[col][strVal]++;
            }
        });
    });

    const stats: Record<string, DescriptiveStats> = {};
    columns.forEach(col => {
        if (numericData[col].length > 0) {
            stats[col] = calculateStats(numericData[col]);
        }
    });

    // Simplified pseudo-correlation: Just 0s for now to fulfill the interface
    const correlations: Record<string, number> = {};

    return {
        stats,
        nullCount,
        correlations,
        categoricalDistribution
    };
}

export async function analyzeCSV(content: string): Promise<AnalysisResult> {
    const data = parseCSV(content);
    return analyzeJSON(data);
}

export async function summarizeDataset(data: any[]): Promise<DataSummary> {
    if (data.length === 0) return { rows: 0, columns: 0, columnsTypes: {} };
    const keys = Object.keys(data[0]);
    const types: Record<string, string> = {};
    keys.forEach(k => {
        types[k] = typeof data[0][k];
    });
    return {
        rows: data.length,
        columns: keys.length,
        columnsTypes: types
    };
}

export async function detectAnomalies(data: any[], column: string): Promise<Anomaly[]> {
    const numericValues = data.map(d => Number(d[column])).filter(v => !isNaN(v));
    if (numericValues.length === 0) return [];

    const stats = calculateStats(numericValues);
    // Z-score method > 3
    const anomalies: Anomaly[] = [];

    data.forEach((row, i) => {
        const val = Number(row[column]);
        if (!isNaN(val) && stats.std > 0) {
            const zscore = Math.abs((val - stats.mean) / stats.std);
            if (zscore > 3) {
                anomalies.push({ row: i + 1, value: val, reason: `Z-score of ${zscore.toFixed(2)} es mayor a 3` });
            }
        }
    });

    return anomalies;
}

export async function generateChart(data: any[], type: 'line' | 'bar' | 'pie' | 'scatter' | 'histogram' | 'heatmap', options: any): Promise<ChartFile> {
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.plot.ly/plotly-2.24.1.min.js"></script>
    </head>
    <body>
      <div id="plot" style="width:800px;height:600px;"></div>
      <script>
        const data = ${JSON.stringify(data)};
        const type = "${type}";
        const options = ${JSON.stringify(options)};
        
        let trace = {};
        if (type === 'bar') {
           trace = { x: data.map(d=>d[options.x]), y: data.map(d=>d[options.y]), type: 'bar' };
        } else if (type === 'line') {
           trace = { x: data.map(d=>d[options.x]), y: data.map(d=>d[options.y]), type: 'scatter', mode: 'lines' };
        } else if (type === 'scatter') {
           trace = { x: data.map(d=>d[options.x]), y: data.map(d=>d[options.y]), type: 'scatter', mode: 'markers' };
        } else if (type === 'pie') {
           trace = { labels: data.map(d=>d[options.x]), values: data.map(d=>d[options.y]), type: 'pie' };
        }
        
        Plotly.newPlot('plot', [trace], { title: options.title || 'Chart' });
      </script>
    </body>
    </html>
  `;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    // Esperar a plotly
    await page.waitForTimeout(1000);

    const buffer = await page.screenshot();
    await browser.close();

    const filename = `charts/chart_${type}_${Date.now()}.png`;
    const record = await writeFile(filename, buffer);

    return {
        url: record.storage_url || '',
        path: record.path
    };
}
