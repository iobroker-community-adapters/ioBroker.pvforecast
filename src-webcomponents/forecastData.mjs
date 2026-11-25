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
 * @returns {Array<{start: number, entries: ReturnType<typeof parseForecast>, energy: number, peak: number, peakTime: number, tempMax: number | null}>} days
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
        let energy = 0;
        for (let j = 1; j < list.length; j++) {
            const dt = (list[j].t - list[j - 1].t) / 3600000;
            if (dt > 0 && dt <= 3) {
                energy += ((list[j].y + list[j - 1].y) / 2) * dt;
            }
        }
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
        result.push({ start: start.getTime(), entries: list, energy, peak, peakTime, tempMax });
    }
    return result;
}
