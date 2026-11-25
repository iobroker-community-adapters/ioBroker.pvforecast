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
});
