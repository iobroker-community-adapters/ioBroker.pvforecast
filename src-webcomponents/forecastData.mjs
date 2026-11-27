// Pure data functions of the pvforecast web component, tested in Node

/**
 * Parses the JSONData state of pvforecast
 *
 * @param {unknown} val value of the state
 * @returns {Array<{t: number, y: number, clearsky?: number, y_min?: number, y_max?: number, temp?: number}>} entries sorted by time
 */
export function parseForecast(val) {
    let data = val;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(data)) {
        return [];
    }
    return data
        .filter(e => e && Number.isFinite(Number(e.t)) && Number.isFinite(Number(e.y)))
        .map(e => ({ ...e, t: Number(e.t), y: Number(e.y) }))
        .sort((a, b) => a.t - b.t);
}

/**
 * Splits the entries into calendar days (local time) and calculates the key figures of every day
 *
 * @param {ReturnType<typeof parseForecast>} entries forecast entries
 * @param {number} dayStart start of the first day (local midnight, ms)
 * @param {number} days number of days
 * @returns {Array<{start: number, entries: ReturnType<typeof parseForecast>, energy: number, peak: number, peakTime: number, tempMax: number | null, energyMin: number | null, energyMax: number | null}>} days
 */
export function splitDays(entries, dayStart, days) {
    const result = [];
    for (let i = 0; i < days; i++) {
        const start = new Date(dayStart);
        start.setDate(start.getDate() + i);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const list = entries.filter(e => e.t >= start.getTime() && e.t < end.getTime());

        // Energy: trapezoidal integration of the power curve (power unit * h); gaps over 3 h are not bridged
        const integrate = value => {
            let sum = 0;
            for (let j = 1; j < list.length; j++) {
                const dt = (list[j].t - list[j - 1].t) / 3600000;
                if (dt > 0 && dt <= 3) {
                    sum += ((value(list[j]) + value(list[j - 1])) / 2) * dt;
                }
            }
            return sum;
        };
        const energy = integrate(e => e.y);
        // Variability band (pvnode Plus): it covers only the next ~40 hours, outside of it the forecast counts
        const hasBand = list.some(e => e.y_min != null && e.y_max != null);
        const energyMin = hasBand ? integrate(e => (e.y_min != null ? Number(e.y_min) : e.y)) : null;
        const energyMax = hasBand ? integrate(e => (e.y_max != null ? Number(e.y_max) : e.y)) : null;
        let peak = 0;
        let peakTime = 0;
        let tempMax = null;
        for (const e of list) {
            if (e.y > peak) {
                peak = e.y;
                peakTime = e.t;
            }
            if (e.temp != null && Number.isFinite(Number(e.temp))) {
                tempMax = tempMax === null ? Number(e.temp) : Math.max(tempMax, Number(e.temp));
            }
        }
        result.push({ start: start.getTime(), entries: list, energy, peak, peakTime, tempMax, energyMin, energyMax });
    }
    return result;
}

/**
 * Formats a power or energy for display: W/Wh from 1000 on as kW/kWh, with sensible decimals
 *
 * @param {number} value value in `unit`
 * @param {string} unit unit of the state: W, kW, Wh, kWh, Wp or kWp
 * @param {string} lang language for the number format
 * @returns {string} value and unit
 */
export function formatValue(value, unit, lang) {
    let v = Number(value);
    let u = unit;
    if (!Number.isFinite(v)) {
        return '-';
    }
    if (/^W/.test(u) && Math.abs(v) >= 1000) {
        v /= 1000;
        u = `k${u}`;
    }
    const abs = Math.abs(v);
    const digits = /^k/.test(u) ? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2) : 0;
    return `${v.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${u}`;
}
