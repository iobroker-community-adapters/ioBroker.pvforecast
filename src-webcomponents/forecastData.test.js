'use strict';

const { expect } = require('chai');

describe('web component forecast data', () => {
    let parseForecast;
    let splitDays;

    before(async () => {
        ({ parseForecast, splitDays } = await import('./forecastData.mjs'));
    });

    it('parses and sorts the JSONData state', () => {
        const entries = parseForecast(JSON.stringify([{ t: 2000, y: 2 }, { t: 1000, y: '1' }, { t: 'x', y: 3 }, null]));

        expect(entries.map(e => [e.t, e.y])).to.deep.equal([
            [1000, 1],
            [2000, 2],
        ]);
        expect(parseForecast('no json')).to.deep.equal([]);
        expect(parseForecast(undefined)).to.deep.equal([]);
    });

    it('splits the entries into days with energy, peak and temperature', () => {
        const day0 = new Date(2026, 5, 24).getTime();
        const h = 3600000;
        const entries = [
            { t: day0 + 10 * h, y: 2, temp: 18 },
            { t: day0 + 11 * h, y: 4, temp: 21.5 },
            { t: day0 + 12 * h, y: 2 },
            { t: day0 + 24 * h + 12 * h, y: 1 },
        ];

        const days = splitDays(entries, day0, 3);

        expect(days).to.have.length(3);
        // trapezoids: (2+4)/2*1 + (4+2)/2*1 = 6
        expect(days[0].energy).to.equal(6);
        expect(days[0].peak).to.equal(4);
        expect(days[0].peakTime).to.equal(day0 + 11 * h);
        expect(days[0].tempMax).to.equal(21.5);
        expect(days[1].entries).to.have.length(1);
        expect(days[1].energy).to.equal(0);
        expect(days[2].entries).to.have.length(0);
        expect(days[2].tempMax).to.equal(null);
    });

    it('does not bridge gaps of more than 3 hours', () => {
        const day0 = new Date(2026, 5, 24).getTime();
        const h = 3600000;
        const days = splitDays(
            [
                { t: day0 + 6 * h, y: 1 },
                { t: day0 + 12 * h, y: 1 },
            ],
            day0,
            1,
        );

        expect(days[0].energy).to.equal(0);
    });

    it('calculates the energy range of the variability band, the forecast outside of the band', () => {
        const day0 = new Date(2026, 5, 24).getTime();
        const h = 3600000;
        const days = splitDays(
            [
                { t: day0 + 10 * h, y: 2 },
                { t: day0 + 11 * h, y: 4, y_min: 3, y_max: 6 },
                { t: day0 + 12 * h, y: 2, y_min: 1, y_max: 3 },
            ],
            day0,
            1,
        );

        expect(days[0].energy).to.equal(6);
        // (2+3)/2 + (3+1)/2 = 4.5 and (2+6)/2 + (6+3)/2 = 8.5
        expect(days[0].energyMin).to.equal(4.5);
        expect(days[0].energyMax).to.equal(8.5);
    });

    it('has no energy range without the variability band', () => {
        const day0 = new Date(2026, 5, 24).getTime();
        const days = splitDays([{ t: day0 + 36e5 * 12, y: 1 }], day0, 1);

        expect(days[0].energyMin).to.equal(null);
        expect(days[0].energyMax).to.equal(null);
    });

    // JSONData of every provider: t and y always, clearsky / temp / y_min / y_max only from pvnode
    const providers = {
        'Forecast.Solar (hourly)': { step: 60, extra: () => ({}) },
        'Solcast (30 min)': { step: 30, extra: () => ({}) },
        'SolarPredictionAPI (hourly)': { step: 60, extra: () => ({}) },
        'pvnode Free/Light (15 min)': { step: 15, extra: y => ({ clearsky: y * 1.2, temp: 18, weather_code: 1 }) },
        'pvnode Plus (15 min)': {
            step: 15,
            extra: y => ({ clearsky: y * 1.2, temp: 18, weather_code: 1, y_min: y * 0.8, y_max: y * 1.1 }),
        },
    };
    for (const [name, { step, extra }] of Object.entries(providers)) {
        it(`handles the JSONData of ${name}`, () => {
            const day0 = new Date(2026, 5, 24).getTime();
            const data = [];
            for (let d = 0; d < 2; d++) {
                for (let m = 6 * 60; m <= 20 * 60; m += step) {
                    const y = Math.round(Math.sin(((m - 360) / 840) * Math.PI) * 5 * 1000) / 1000;
                    data.push({ t: day0 + d * 864e5 + m * 60000, y, ...extra(y) });
                }
            }

            const days = splitDays(parseForecast(JSON.stringify(data)), day0, 2);

            for (const day of days) {
                // area of a sine half wave: 5 kW * 14 h * 2/pi = 44.6 kWh
                expect(day.energy).to.be.closeTo(44.6, step === 60 ? 0.6 : 0.2);
                expect(day.peak).to.be.closeTo(5, 0.01);
                expect(day.tempMax).to.equal(name.startsWith('pvnode') ? 18 : null);
                if (name === 'pvnode Plus (15 min)') {
                    expect(day.energyMin).to.be.closeTo(day.energy * 0.8, 0.01);
                    expect(day.energyMax).to.be.closeTo(day.energy * 1.1, 0.01);
                } else {
                    expect(day.energyMin).to.equal(null);
                }
            }
        });
    }
});
