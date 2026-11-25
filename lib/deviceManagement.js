'use strict';

const { DeviceManagement } = require('@iobroker/dm-utils');

const WEB_COMPONENT = 'webcomponents/iob-pvforecast.json';
const SUMMARY_ID = 'summary';

/**
 * Builds the list of devices: the summary of all plants and every configured plant.
 *
 * @param {Array<{name: string}>} plants configured plants
 * @param {(name: string) => string} cleanNamespace function that turns a plant name into its object ID
 * @returns {Array<{id: string, name: ioBroker.StringOrTranslated, base: string}>} devices
 */
function getForecastDevices(plants, cleanNamespace) {
    const devices = [];
    devices.push({
        id: SUMMARY_ID,
        name: { en: 'Total of all plants', de: 'Summe aller Anlagen' },
        base: 'summary',
    });
    for (const plant of plants || []) {
        if (!plant || !plant.name) {
            continue;
        }
        const id = cleanNamespace(plant.name);
        devices.push({ id, name: plant.name, base: `plants.${id}` });
    }
    return devices;
}

/**
 * Options for the plant selection of the web component (`selectSendTo` with command `getPlants`).
 *
 * @param {Array<{name: string}>} plants configured plants
 * @param {(name: string) => string} cleanNamespace function that turns a plant name into its object ID
 * @returns {Array<{value: string, label: ioBroker.StringOrTranslated}>} options
 */
function getPlantOptions(plants, cleanNamespace) {
    return getForecastDevices(plants, cleanNamespace).map(d => ({ value: d.id, label: d.name }));
}

const SERVICE_NAMES = {
    forecastsolar: 'Forecast.Solar',
    solcast: 'Solcast',
    spa: 'SolarPredictionAPI',
    pvnode: 'pvnode',
};

/**
 * Describes the forecast service of the configuration, for every provider.
 *
 * @param {{service?: string, pvnodeTier?: string, pvnodeV2?: boolean}} config configuration of the instance
 * @returns {{service: string, model: string, variability: boolean}} name of the service, its plan, and whether the variability band (pvnode Plus, API v2) is requested
 */
function getServiceInfo(config) {
    const service = (config && config.service) || 'forecastsolar';
    const name = SERVICE_NAMES[service] || service;
    if (service !== 'pvnode') {
        return { service: name, model: '', variability: false };
    }
    const tier = config.pvnodeTier || 'free';
    return {
        service: name,
        model: `${tier.charAt(0).toUpperCase()}${tier.slice(1)}${config.pvnodeV2 ? ' (API v2)' : ' (API v1)'}`,
        variability: tier === 'plus' && !!config.pvnodeV2,
    };
}

/**
 * Shows the summary and every plant of pvforecast in the device manager, with the forecast as details.
 */
class PvforecastDeviceManagement extends DeviceManagement {
    getDevices() {
        // @ts-expect-error methods of the adapter class
        return getForecastDevices(this.adapter.getPlantConfigData(), name => this.adapter.cleanNamespace(name));
    }

    loadDevices(context) {
        const devices = this.getDevices();
        context.setTotalDevices(devices.length);
        const ns = this.adapter.namespace;
        const info = getServiceInfo(this.adapter.config);
        for (const device of devices) {
            const base = `${ns}.${device.base}`;
            context.addDevice({
                id: device.id,
                name: device.name,
                manufacturer: info.service,
                ...(info.model ? { model: info.model } : {}),
                hasDetails: true,
                indicators: [
                    {
                        id: 'powerNow',
                        value: { stateId: `${base}.power.now` },
                        icon: 'fa-bolt',
                        showValue: true,
                        unit: this.adapter.config.watt_kw ? 'W' : 'kW',
                        tooltip: { en: 'Power now', de: 'Leistung jetzt' },
                        hideIfEmpty: false,
                    },
                    {
                        id: 'energyToday',
                        value: { stateId: `${base}.energy.today` },
                        icon: 'fa-sun',
                        showValue: true,
                        unit: this.adapter.config.watt_kw ? 'Wh' : 'kWh',
                        tooltip: { en: 'Energy today', de: 'Energie heute' },
                        hideIfEmpty: false,
                    },
                    {
                        id: 'energyTomorrow',
                        value: { stateId: `${base}.energy.tomorrow` },
                        icon: 'fa-calendar',
                        showValue: true,
                        unit: this.adapter.config.watt_kw ? 'Wh' : 'kWh',
                        tooltip: { en: 'Energy tomorrow', de: 'Energie morgen' },
                        hideIfEmpty: false,
                    },
                ],
            });
        }
    }

    // @ts-expect-error `webComponent` of a `custom` item (JSON-Config >= 10.1.14) is not in the types of dm-utils yet
    async getDeviceDetails(id) {
        const device = this.getDevices().find(d => d.id === id);
        if (!device) {
            return null;
        }
        const base = device.base;
        const wattKw = !!this.adapter.config.watt_kw;
        const read = async stateId => {
            const state = await this.adapter.getStateAsync(`${base}.${stateId}`);
            return state ? state.val : null;
        };
        const [installed, today, tomorrow, updated] = await Promise.all([
            read('power.installed'),
            read('energy.today'),
            read('energy.tomorrow'),
            read('lastUpdated'),
        ]);

        const info = getServiceInfo(this.adapter.config);
        const items = {
            service: {
                type: 'staticInfo',
                label: { en: 'Forecast service', de: 'Prognosedienst' },
                data: info.model ? `${info.service} ${info.model}` : info.service,
                xs: 12,
                sm: 6,
                md: 6,
            },
            variability: {
                type: 'staticInfo',
                label: { en: 'Variability band (min/max)', de: 'Variabilitätsband (Min/Max)' },
                data: !info.variability
                    ? { en: 'only with pvnode Plus (API v2)', de: 'nur mit pvnode Plus (API v2)' }
                    : // @ts-expect-error property of the adapter class
                      this.adapter.pvnodeVariabilityUnavailable
                      ? { en: 'not provided by the pvnode plan', de: 'vom pvnode-Tarif nicht geliefert' }
                      : { en: 'active (pvnode Plus)', de: 'aktiv (pvnode Plus)' },
                xs: 12,
                sm: 6,
                md: 6,
            },
            installed: {
                type: 'staticInfo',
                label: { en: 'Installed power', de: 'Installierte Leistung' },
                data: installed ?? '-',
                unit: wattKw ? 'Wp' : 'kWp',
                xs: 12,
                sm: 6,
                md: 3,
            },
            today: {
                type: 'staticInfo',
                label: { en: 'Energy today', de: 'Energie heute' },
                data: today ?? '-',
                unit: wattKw ? 'Wh' : 'kWh',
                xs: 12,
                sm: 6,
                md: 3,
            },
            tomorrow: {
                type: 'staticInfo',
                label: { en: 'Energy tomorrow', de: 'Energie morgen' },
                data: tomorrow ?? '-',
                unit: wattKw ? 'Wh' : 'kWh',
                xs: 12,
                sm: 6,
                md: 3,
            },
            updated: {
                type: 'staticInfo',
                label: { en: 'Last update', de: 'Letzte Aktualisierung' },
                data: updated ? new Date(Number(updated)).toLocaleString() : '-',
                xs: 12,
                sm: 6,
                md: 3,
            },
            forecast: {
                type: 'custom',
                webComponent: WEB_COMPONENT,
                height: 380,
                xs: 12,
                settings: {
                    instance: this.adapter.namespace,
                    plant: device.id,
                    days: 7,
                },
            },
        };

        return {
            id,
            schema: { type: 'panel', items },
            data: {},
        };
    }
}

module.exports = { PvforecastDeviceManagement, getForecastDevices, getPlantOptions, getServiceInfo };
