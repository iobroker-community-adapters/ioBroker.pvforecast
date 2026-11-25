'use strict';

const { expect } = require('chai');
const { PvforecastDeviceManagement, getForecastDevices, getPlantOptions } = require('./deviceManagement');

const clean = name => name.trim().replace(/\s/g, '_').toLowerCase();

describe('deviceManagement', () => {
    it('lists the summary and every plant', () => {
        const devices = getForecastDevices([{ name: 'Roof South' }, { name: '' }, { name: 'Garage' }], clean);

        expect(devices.map(d => d.id)).to.deep.equal(['summary', 'roof_south', 'garage']);
        expect(devices[0].base).to.equal('summary');
        expect(devices[1]).to.include({ name: 'Roof South', base: 'plants.roof_south' });
    });

    it('lists only the summary without plants', () => {
        expect(getForecastDevices([], clean).map(d => d.id)).to.deep.equal(['summary']);
    });

    it('gives the plants as options of the web component', () => {
        const options = getPlantOptions([{ name: 'Roof South' }], clean);

        expect(options).to.have.length(2);
        expect(options[0].value).to.equal('summary');
        expect(options[1]).to.deep.equal({ value: 'roof_south', label: 'Roof South' });
    });

    describe('PvforecastDeviceManagement', () => {
        const states = {
            'summary.power.installed': { val: 9.8 },
            'summary.energy.today': { val: 41.2 },
            'plants.roof_south.energy.tomorrow': { val: 12.3 },
        };
        const adapter = {
            namespace: 'pvforecast.0',
            config: { watt_kw: false },
            on: () => {},
            getPlantConfigData: () => [{ name: 'Roof South' }],
            cleanNamespace: clean,
            getStateAsync: async id => states[id] || null,
        };
        // @ts-expect-error a fake adapter is enough for the tests
        const dm = new PvforecastDeviceManagement(adapter);

        it('adds the summary and the plants with live indicators', () => {
            const added = [];
            let total = 0;
            dm.loadDevices({ setTotalDevices: n => (total = n), addDevice: d => added.push(d) });

            expect(total).to.equal(2);
            expect(added.map(d => d.id)).to.deep.equal(['summary', 'roof_south']);
            expect(added[1].hasDetails).to.equal(true);
            expect(added[1].indicators[0].value).to.deep.equal({ stateId: 'pvforecast.0.plants.roof_south.power.now' });
            expect(added[0].indicators[1].unit).to.equal('kWh');
        });

        it('shows the key figures and the web component as details', async () => {
            const details = await dm.getDeviceDetails('summary');
            if (!details) {
                throw new Error('no details');
            }

            expect(details.schema.items.installed.data).to.equal(9.8);
            expect(details.schema.items.today.data).to.equal(41.2);
            expect(details.schema.items.tomorrow.data).to.equal('-');
            expect(details.schema.items.forecast).to.include({
                type: 'custom',
                webComponent: 'webcomponents/pvforecast-forecast.json',
            });
            expect(details.schema.items.forecast.settings).to.deep.equal({
                instance: 'pvforecast.0',
                plant: 'summary',
                days: 7,
            });
        });

        it('returns null for an unknown device', async () => {
            expect(await dm.getDeviceDetails('unknown')).to.equal(null);
        });
    });
});
