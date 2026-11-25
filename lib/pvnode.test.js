'use strict';

const { expect } = require('chai');
const pvnode = require('../lib/pvnode');

describe('Test pvnode v2 Converter', () => {
    it('adds the variability band (pv_power_min / pv_power_max) when present', () => {
        const data = {
            values: [
                { timestamp: '2026-06-24T12:00:00', pv_power: 4000.4, pv_power_min: 2500.6, pv_power_max: 5200.2 },
                { timestamp: '2026-06-24T12:15:00', pv_power: 4100 },
            ],
        };

        const converted = pvnode.convertV2ToForecast(data);

        expect(converted.watts['2026-06-24 12:00:00']).to.equal(4000);
        expect(converted.watts_min).to.deep.equal({ '2026-06-24 12:00:00': 2501 });
        expect(converted.watts_max).to.deep.equal({ '2026-06-24 12:00:00': 5200 });
    });

    it('returns empty variability band without pv_power_min / pv_power_max', () => {
        const converted = pvnode.convertV2ToForecast({
            values: [{ timestamp: '2026-06-24T12:00:00', pv_power: 4000 }],
        });

        expect(converted.watts_min).to.deep.equal({});
        expect(converted.watts_max).to.deep.equal({});
    });
});
