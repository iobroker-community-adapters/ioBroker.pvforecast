// Web component of @iobroker/web-components: shows the PV forecast of pvforecast for several days.
// Built with `npm run build:webcomponents` to admin/webcomponents/iob-pvforecast.js
import { IobWebComponent, defineWebComponent } from '@iobroker/web-components/element';
import { formatValue, parseForecast, splitDays } from './forecastData.mjs';

const TAG = 'iob-pvforecast';
const DAY_MS = 24 * 60 * 60 * 1000;
// Chart coordinates (SVG viewBox), stretched to the size of the element
const VB_W = 1000;
const VB_H = 300;

const TEXTS = {
    summary: { en: 'Total', de: 'Gesamt' },
    now: { en: 'Now', de: 'Jetzt' },
    installed: { en: 'Installed', de: 'Installiert' },
    updated: { en: 'Updated', de: 'Aktualisiert' },
    today: { en: 'Today', de: 'Heute' },
    tomorrow: { en: 'Tomorrow', de: 'Morgen' },
    peak: { en: 'Peak', de: 'Spitze' },
    forecast: { en: 'Forecast', de: 'Prognose' },
    clearsky: { en: 'Clear sky', de: 'Klarer Himmel' },
    band: { en: 'Variability band', de: 'Variabilitätsband' },
    noData: { en: 'No forecast data yet', de: 'Noch keine Prognosedaten' },
    sample: { en: 'Sample data', de: 'Beispieldaten' },
    estimated: { en: 'estimated from the forecast curve', de: 'aus der Prognosekurve berechnet' },
    info: { en: 'Information and all forecast days', de: 'Informationen und alle Prognosetage' },
    allDays: { en: 'All forecast days', de: 'Alle Prognosetage' },
    service: { en: 'Forecast service', de: 'Prognosedienst' },
    plant: { en: 'Plant', de: 'Anlage' },
};

const SERVICE_NAMES = {
    forecastsolar: 'Forecast.Solar',
    solcast: 'Solcast',
    spa: 'SolarPredictionAPI',
    pvnode: 'pvnode',
};

const STYLE = `
:host { display: block; width: 100%; height: 100%; container-type: size; }
* { box-sizing: border-box; }
.root { display: flex; flex-direction: column; width: 100%; height: 100%; gap: 2cqmin; padding: 2cqmin;
    font-family: var(--iob-font-family); font-size: clamp(10px, 3.2cqmin, 15px); color: var(--iob-text); }
.head { display: flex; align-items: center; gap: 0.6em; min-width: 0; }
.title { flex: 1 1 auto; min-width: 0; font-weight: 600; font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { flex: 0 0 auto; color: var(--iob-text-secondary); font-size: 0.85em; white-space: nowrap; }
.meta b { color: var(--iob-text); font-weight: 600; }
.info { flex: 0 0 auto; width: 1.7em; height: 1.7em; padding: 0; border-radius: 50%; border: 1px solid var(--iob-divider);
    background: transparent; color: var(--iob-text-secondary); font: inherit; font-weight: 600; cursor: pointer; line-height: 1; }
.info:hover { color: var(--iob-primary); border-color: var(--iob-primary); }
.days { display: grid; grid-template-columns: repeat(auto-fit, minmax(6.5em, 1fr)); gap: 1.5cqmin; }
.day { display: flex; flex-direction: column; justify-content: flex-start; min-width: 0; overflow: hidden; background: var(--iob-paper); border: 1px solid var(--iob-divider); border-radius: calc(var(--iob-border-radius) * 2);
    padding: 0.35em 0.5em; cursor: pointer; font: inherit; color: inherit; text-align: left; }
.day.sel { border-color: var(--iob-primary); box-shadow: inset 0 0 0 1px var(--iob-primary); }
.day .d { font-size: 0.8em; color: var(--iob-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.day .e { font-size: 1.2em; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.day .x { font-size: 0.75em; color: var(--iob-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.days.many .day { font-size: 0.85em; }
.day .b { color: var(--iob-text); }
.chart { position: relative; flex: 1 1 auto; min-height: 4em; }
.chart svg { position: absolute; inset: 0 0 1.4em 0; width: 100%; height: calc(100% - 1.4em); overflow: visible; }
.axis { position: absolute; left: 0; right: 0; bottom: 0; height: 1.4em; font-size: 0.75em; color: var(--iob-text-secondary); }
.axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.ymax { position: absolute; left: 0.2em; top: 0; font-size: 0.75em; color: var(--iob-text-secondary); }
.tip { position: absolute; top: 0; pointer-events: none; background: var(--iob-paper); border: 1px solid var(--iob-divider);
    border-radius: var(--iob-border-radius); padding: 0.3em 0.5em; font-size: 0.8em; white-space: nowrap; display: none; }
.legend { display: flex; flex-wrap: wrap; gap: 0.3em 1em; font-size: 0.8em; color: var(--iob-text-secondary); }
.legend i { display: inline-block; width: 1.2em; height: 0.6em; margin-right: 0.35em; vertical-align: middle; border-radius: 2px; }
.empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--iob-text-secondary); }
.badge { font-size: 0.75em; color: var(--iob-warning); }
`;

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
}

function sampleData(dayStart, days) {
    const entries = [];
    for (let d = 0; d < days; d++) {
        const factor = [1, 0.6, 0.85, 0.4, 0.95, 0.7, 0.5][d % 7];
        for (let h = 5; h <= 21; h += 0.25) {
            const t = dayStart + d * DAY_MS + h * 3600000;
            const clearsky = Math.max(0, Math.sin(((h - 5) / 16) * Math.PI)) * 8;
            const y = clearsky * factor;
            entries.push({
                t,
                y,
                clearsky,
                y_min: y * 0.7,
                y_max: Math.min(clearsky, y * 1.25),
                temp: 12 + 8 * factor,
            });
        }
    }
    return entries;
}

class PvforecastForecast extends IobWebComponent {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        // index of the day shown alone, null for all days
        this.selectedDay = null;
        this.chartRange = null;

        this.shadowRoot.addEventListener('click', e => {
            const target = e.target;
            if (target.closest && target.closest('.info')) {
                if (!this.editMode) {
                    void this.openInfo();
                }
                return;
            }
            const day = target.closest && target.closest('.day');
            if (!day || this.editMode) {
                return;
            }
            const index = Number(day.getAttribute('data-day'));
            this.selectedDay = this.selectedDay === index ? null : index;
            this.render();
        });
        this.shadowRoot.addEventListener('pointermove', e => this.showTip(e));
        this.shadowRoot.addEventListener('pointerleave', () => this.hideTip());
    }

    /** @param {{instance?: string, plant?: string}} settings settings of the manifest */
    getBase(settings) {
        const instance = String(settings.instance || 'pvforecast.0').replace(/^system\.adapter\./, '');
        const plant = settings.plant || 'summary';
        return plant === 'summary' ? `${instance}.summary` : `${instance}.plants.${plant}`;
    }

    getStateIds(settings) {
        if (!settings) {
            return [];
        }
        const base = this.getBase(settings);
        return [
            `${base}.JSONData`,
            `${base}.power.now`,
            `${base}.power.installed`,
            `${base}.energy.today`,
            `${base}.energy.tomorrow`,
            // pvnode Light/Plus: energy of the following days (adapter >= 7.0.0)
            ...[2, 3, 4, 5, 6].map(offset => `${base}.energy.day${offset}`),
            `${base}.lastUpdated`,
            (settings.plant || 'summary') === 'summary' ? null : `${base}.name`,
        ];
    }

    t(key) {
        return this.text(TEXTS[key]);
    }

    unit(id, fallback) {
        const obj = this.objects[id];
        return (obj && obj.common && obj.common.unit) || fallback;
    }

    /**
     * @param {number} value value in `unit`
     * @param {string} unit unit of the state
     */
    fmt(value, unit) {
        return escapeHtml(formatValue(value, unit, this.systemLang));
    }

    format(value, digits) {
        return Number(value).toLocaleString(this.systemLang, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
        });
    }

    render() {
        const settings = this.settings || {};
        const base = this.getBase(settings);
        const days = Math.min(Math.max(Number(settings.days) || 2, 1), 7);
        const powerUnit = this.unit(`${base}.power.now`, 'kW');
        const energyUnit = this.unit(`${base}.energy.today`, `${powerUnit}h`);
        const digits = /^k/.test(powerUnit) ? 1 : 0;
        const lang = this.systemLang;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let entries = parseForecast(this.states[`${base}.JSONData`]?.val);
        let sample = false;
        if (!entries.length && (this.editMode || !this.socket)) {
            entries = sampleData(todayStart.getTime(), days);
            sample = true;
        }

        const isSummary = (settings.plant || 'summary') === 'summary';
        const title =
            settings.title ||
            (isSummary ? this.t('summary') : String(this.states[`${base}.name`]?.val || settings.plant));

        const nowVal = this.states[`${base}.power.now`]?.val;

        const header =
            settings.showHeader === false
                ? ''
                : `<div class="head"><span class="title">${escapeHtml(title)}${
                      sample ? ` <span class="badge">${escapeHtml(this.t('sample'))}</span>` : ''
                  }</span>${
                      nowVal != null && !sample
                          ? `<span class="meta">${escapeHtml(this.t('now'))} <b>${this.fmt(nowVal, powerUnit)}</b></span>`
                          : ''
                  }${
                      settings.showInfo === false
                          ? ''
                          : `<button class="info" title="${escapeHtml(this.t('info'))}">i</button>`
                  }</div>`;

        if (!entries.length) {
            this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="root">${header}<div class="empty">${escapeHtml(this.t('noData'))}</div></div>`;
            return;
        }

        const dayList = splitDays(entries, todayStart.getTime(), days);
        // The adapter has the exact energy of the service for today, tomorrow and (pvnode Light/Plus) day 2-6
        const exact = [
            this.states[`${base}.energy.today`]?.val,
            this.states[`${base}.energy.tomorrow`]?.val,
            ...[2, 3, 4, 5, 6].map(offset => this.states[`${base}.energy.day${offset}`]?.val),
        ];
        const energyFactor =
            energyUnit.startsWith('k') === powerUnit.startsWith('k') ? 1 : powerUnit.startsWith('k') ? 1000 : 0.001;

        const showBand = settings.showVariability !== false;

        if (this.selectedDay !== null && this.selectedDay >= dayList.length) {
            this.selectedDay = null;
        }

        const tiles = dayList
            .map((day, i) => {
                const label =
                    i === 0
                        ? this.t('today')
                        : i === 1
                          ? this.t('tomorrow')
                          : new Date(day.start).toLocaleDateString(lang, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'numeric',
                            });
                const isExact = exact[i] != null && !sample && (i < 2 || day.entries.length > 0);
                const energy = isExact ? Number(exact[i]) : day.energy * energyFactor;
                const peak = day.peak
                    ? `${escapeHtml(this.t('peak'))} ${this.fmt(day.peak, powerUnit)} · ${new Date(
                          day.peakTime,
                      ).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}`
                    : '&nbsp;';
                const temp = day.tempMax !== null ? ` · ${this.format(day.tempMax, 0)} °C` : '';
                // Variability band (pvnode Plus): range of the energy, shifted to the energy shown
                let band = '';
                if (showBand && day.energyMin !== null && day.energyMax !== null) {
                    const min = Math.max(0, energy - (day.energy - day.energyMin) * energyFactor);
                    const max = energy + (day.energyMax - day.energy) * energyFactor;
                    band = `<div class="x b" title="${escapeHtml(this.t('band'))}">↕ ${this.fmt(min, energyUnit)} – ${this.fmt(
                        max,
                        energyUnit,
                    )}</div>`;
                }
                return `<button class="day${this.selectedDay === i ? ' sel' : ''}" data-day="${i}" title="${
                    isExact ? '' : escapeHtml(this.t('estimated'))
                }"><div class="d">${escapeHtml(label)}</div><div class="e">${isExact ? '' : '≈ '}${this.fmt(
                    energy,
                    energyUnit,
                )}</div>${band}<div class="x">${peak}${temp}</div></button>`;
            })
            .join('');

        // Chart range: all days or the selected one, cut to the hours with sun
        const shown = this.selectedDay === null ? dayList : [dayList[this.selectedDay]];
        const shownEntries = shown.flatMap(d => d.entries);
        const from = shown[0].start;
        const to = shown[shown.length - 1].start + DAY_MS;
        this.chartRange = { from, to, entries: shownEntries, powerUnit, digits };

        const maxY =
            Math.max(1e-9, ...shownEntries.map(e => Math.max(e.y, Number(e.y_max) || 0, Number(e.clearsky) || 0))) *
            1.08;
        const x = t => ((t - from) / (to - from)) * VB_W;
        const y = v => VB_H - (Math.max(0, v) / maxY) * VB_H;

        const showClearsky = settings.showClearsky !== false;

        const segments = [];
        for (const day of shown) {
            if (day.entries.length) {
                segments.push(day.entries);
            }
        }
        const linePath = key =>
            segments
                .map(list => {
                    const pts = list.filter(e => e[key] != null && Number.isFinite(Number(e[key])));
                    return pts.length
                        ? `M${pts.map(e => `${x(e.t).toFixed(1)},${y(Number(e[key])).toFixed(1)}`).join('L')}`
                        : '';
                })
                .join('');
        const areaPath = segments
            .map(
                list =>
                    `M${x(list[0].t).toFixed(1)},${VB_H}L${list.map(e => `${x(e.t).toFixed(1)},${y(e.y).toFixed(1)}`).join('L')}L${x(list[list.length - 1].t).toFixed(1)},${VB_H}Z`,
            )
            .join('');
        const bandPath = segments
            .map(list => {
                const pts = list.filter(e => e.y_min != null && e.y_max != null);
                if (pts.length < 2) {
                    return '';
                }
                const upper = pts.map(e => `${x(e.t).toFixed(1)},${y(Number(e.y_max)).toFixed(1)}`).join('L');
                const lower = pts
                    .slice()
                    .reverse()
                    .map(e => `${x(e.t).toFixed(1)},${y(Number(e.y_min)).toFixed(1)}`)
                    .join('L');
                return `M${upper}L${lower}Z`;
            })
            .join('');
        const hasBand = showBand && bandPath !== '';
        const clearPath = showClearsky ? linePath('clearsky') : '';

        const theme = this.theme;
        const color = settings.color || '#f5a623';
        const now = Date.now();
        const separators = shown
            .slice(1)
            .map(
                d =>
                    `<line x1="${x(d.start)}" x2="${x(d.start)}" y1="0" y2="${VB_H}" stroke="${theme.divider}" vector-effect="non-scaling-stroke"/>`,
            )
            .join('');
        const nowLine =
            now > from && now < to
                ? `<line x1="${x(now)}" x2="${x(now)}" y1="0" y2="${VB_H}" stroke="${theme.error}" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>`
                : '';

        // Axis labels: the hours for one day, the days otherwise
        let axis = '';
        if (shown.length === 1) {
            for (let h = 0; h <= 24; h += 3) {
                axis += `<span style="left:${((h * 3600000) / DAY_MS) * 100}%">${h}:00</span>`;
            }
            axis = axis
                .replace('<span style="left:0%">', '<span style="left:0%;transform:none">')
                .replace('<span style="left:100%">', '<span style="left:100%;transform:translateX(-100%)">');
        } else {
            axis = shown
                .map(
                    (d, i) =>
                        `<span style="left:${((i + 0.5) / shown.length) * 100}%">${escapeHtml(
                            new Date(d.start).toLocaleDateString(lang, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'numeric',
                            }),
                        )}</span>`,
                )
                .join('');
        }

        const legend = `<div class="legend"><span><i style="background:${color}"></i>${escapeHtml(this.t('forecast'))}</span>${
            hasBand ? `<span><i style="background:${color};opacity:.3"></i>${escapeHtml(this.t('band'))}</span>` : ''
        }${
            clearPath
                ? `<span><i style="background:none;border-top:2px dashed ${theme.textSecondary};height:0"></i>${escapeHtml(this.t('clearsky'))}</span>`
                : ''
        }</div>`;

        this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="root">${header}${
            settings.showTiles === false ? '' : `<div class="days${dayList.length > 4 ? ' many' : ''}">${tiles}</div>`
        }<div class="chart">
<svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none">
${separators}
${hasBand ? `<path d="${bandPath}" fill="${color}" fill-opacity="0.25" stroke="none"/>` : ''}
<path d="${areaPath}" fill="${color}" fill-opacity="${hasBand ? 0.15 : 0.35}" stroke="none"/>
<path d="${linePath('y')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>
${clearPath ? `<path d="${clearPath}" fill="none" stroke="${theme.textSecondary}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>` : ''}
${nowLine}
<line class="cursor" x1="0" x2="0" y1="0" y2="${VB_H}" stroke="${theme.text}" stroke-opacity="0.4" vector-effect="non-scaling-stroke" visibility="hidden"/>
</svg>
<div class="ymax">${this.fmt(maxY / 1.08, powerUnit)}</div>
<div class="axis">${axis}</div>
<div class="tip"></div>
</div>${legend}</div>`;
    }

    showTip(event) {
        const svg = this.shadowRoot.querySelector('svg');
        const tip = this.shadowRoot.querySelector('.tip');
        const cursor = this.shadowRoot.querySelector('.cursor');
        const range = this.chartRange;
        if (!svg || !tip || !cursor || !range || !range.entries.length || !event.composedPath().includes(svg)) {
            this.hideTip();
            return;
        }
        const rect = svg.getBoundingClientRect();
        const fraction = (event.clientX - rect.left) / rect.width;
        const t = range.from + fraction * (range.to - range.from);
        let best = range.entries[0];
        for (const e of range.entries) {
            if (Math.abs(e.t - t) < Math.abs(best.t - t)) {
                best = e;
            }
        }
        if (Math.abs(best.t - t) > 2 * 3600000) {
            this.hideTip();
            return;
        }
        const pos = ((best.t - range.from) / (range.to - range.from)) * VB_W;
        cursor.setAttribute('x1', String(pos));
        cursor.setAttribute('x2', String(pos));
        cursor.setAttribute('visibility', 'visible');
        const u = range.powerUnit;
        const lines = [
            `<b>${new Date(best.t).toLocaleString(this.systemLang, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</b>`,
            `${escapeHtml(this.t('forecast'))}: ${this.fmt(best.y, u)}`,
        ];
        if (best.y_min != null && best.y_max != null) {
            lines.push(`↕ ${this.fmt(best.y_min, u)} – ${this.fmt(best.y_max, u)}`);
        }
        if (best.clearsky != null) {
            lines.push(`${escapeHtml(this.t('clearsky'))}: ${this.fmt(best.clearsky, u)}`);
        }
        if (best.temp != null) {
            lines.push(`${this.format(best.temp, 1)} °C`);
        }
        tip.innerHTML = lines.join('<br>');
        tip.style.display = 'block';
        const left = (pos / VB_W) * 100;
        tip.style.left = left > 60 ? '' : `calc(${left}% + 8px)`;
        tip.style.right = left > 60 ? `calc(${100 - left}% + 8px)` : '';
    }

    /** Dialog with the information about the plant and the forecast of all days */
    async openInfo() {
        const settings = this.settings || {};
        const base = this.getBase(settings);
        const instance = String(settings.instance || 'pvforecast.0').replace(/^system\.adapter\./, '');
        const powerUnit = this.unit(`${base}.power.now`, 'kW');
        const installed = this.states[`${base}.power.installed`]?.val;
        const updated = this.states[`${base}.lastUpdated`]?.val;

        let service = '';
        try {
            const obj = await this.socket?.getObject(`system.adapter.${instance}`);
            const native = obj?.native || {};
            const name = SERVICE_NAMES[native.service] || native.service || '';
            const tier =
                native.service === 'pvnode' && native.pvnodeTier
                    ? ` ${native.pvnodeTier.charAt(0).toUpperCase()}${native.pvnodeTier.slice(1)}`
                    : '';
            service = name ? `${name}${tier}` : '';
        } catch {
            // without the instance object the service is not shown
        }

        // all days with forecast data, at least 1
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const entries = parseForecast(this.states[`${base}.JSONData`]?.val);
        const available = splitDays(entries, todayStart.getTime(), 7).filter(d => d.entries.length).length || 1;

        const rows = [
            [this.t('plant'), this.shadowRoot.querySelector('.title')?.textContent || ''],
            [this.t('service'), service],
            [
                this.t('installed'),
                installed != null
                    ? formatValue(installed, this.unit(`${base}.power.installed`, `${powerUnit}p`), this.systemLang)
                    : '',
            ],
            [
                this.t('now'),
                this.states[`${base}.power.now`]?.val != null
                    ? formatValue(this.states[`${base}.power.now`].val, powerUnit, this.systemLang)
                    : '',
            ],
            [
                this.t('updated'),
                updated
                    ? new Date(Number(updated)).toLocaleString(this.systemLang, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                      })
                    : '',
            ],
        ].filter(r => r[1]);

        const content = this.ownerDocument.createElement('div');
        const root = content.attachShadow({ mode: 'open' });
        root.innerHTML = `<style>
:host { display: block; }
.box { display: flex; flex-direction: column; gap: 12px; font-family: var(--iob-font-family, inherit); color: inherit; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
dt { color: var(--iob-text-secondary, #888); }
dd { margin: 0; font-weight: 600; }
.chart { width: min(860px, 85vw); height: min(440px, 60vh); }
</style><div class="box"><dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl><div class="chart"></div></div>`;
        const full = this.ownerDocument.createElement(TAG);
        full.theme = this.theme;
        full.socket = this.socket;
        full.settings = { ...settings, days: available, showHeader: false, showTiles: true, showInfo: false };
        root.querySelector('.chart').appendChild(full);

        await this.openDialog({ title: `${this.t('allDays')} (${available})`, element: content, width: 920 });
    }

    hideTip() {
        const tip = this.shadowRoot.querySelector('.tip');
        const cursor = this.shadowRoot.querySelector('.cursor');
        if (tip) {
            tip.style.display = 'none';
        }
        if (cursor) {
            cursor.setAttribute('visibility', 'hidden');
        }
    }
}

defineWebComponent(TAG, PvforecastForecast);
