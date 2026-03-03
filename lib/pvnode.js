'use strict';

const moment = require('moment');

/**
 * Convert pvnode API response to the standard forecast format used by the adapter.
 *
 * pvnode returns 15-minute interval data with pv_watts (power in watts).
 * This function converts it to the same format as forecast.solar:
 * - watts: peak power at each timestamp (W)
 * - watt_hours_period: energy produced in that period (Wh)
 * - watt_hours: cumulative energy for the day (Wh)
 * - watt_hours_day: total energy per day (Wh)
 *
 * Additionally, pvnode-specific fields are included:
 * - watts_clearsky: clear-sky reference power at each timestamp (W)
 * - temperature: temperature at each timestamp (°C)
 * - weather_code: WMO weather code at each timestamp
 *
 * @param {object} dataJson - The pvnode API response containing a "values" array
 * @returns {object} Standard forecast format with pvnode extensions
 */
function convertToForecast(dataJson) {
    const convertJson = {
        watts: {},
        watt_hours_period: {},
        watt_hours: {},
        watt_hours_day: {},
        watts_clearsky: {},
        temperature: {},
        weather_code: {},
    };

    if (!dataJson || !dataJson.values || !Array.isArray(dataJson.values)) {
        return convertJson;
    }

    // Group values by date
    const valuesByDate = {};
    for (const entry of dataJson.values) {
        const timeMoment = moment.utc(entry.dtm).local();
        const dateKey = timeMoment.format('YYYY-MM-DD');

        if (!valuesByDate[dateKey]) {
            valuesByDate[dateKey] = [];
        }
        valuesByDate[dateKey].push(entry);
    }

    // Process each date
    for (const dateKey of Object.keys(valuesByDate).sort()) {
        const entries = valuesByDate[dateKey];
        let cumulativeEnergy = 0;
        let dailyTotal = 0;

        for (const entry of entries) {
            const timeMoment = moment.utc(entry.dtm).local();
            const timeStr = timeMoment.format('YYYY-MM-DD HH:mm:ss');
            const hour = timeMoment.hour();

            // Only include hours between 5:00 and 22:00 (consistent with solcast converter)
            if (hour >= 5 && hour < 22) {
                const pvWatts = Math.round(entry.pv_watts || 0);

                // watts: power at this timestamp in watts
                convertJson.watts[timeStr] = pvWatts;

                // watt_hours_period: energy in this 15-min period (power_W * 0.25h = Wh)
                const periodEnergy = Math.round(pvWatts * 0.25);
                convertJson.watt_hours_period[timeStr] = periodEnergy;

                cumulativeEnergy += periodEnergy;
                convertJson.watt_hours[timeStr] = cumulativeEnergy;

                dailyTotal += periodEnergy;

                // pvnode-specific: clearsky, temperature, weather_code
                if (entry.pv_watts_clearsky != null) {
                    convertJson.watts_clearsky[timeStr] = Math.round(entry.pv_watts_clearsky);
                }
                if (entry.temp != null) {
                    convertJson.temperature[timeStr] = Math.round(entry.temp * 10) / 10;
                }
                if (entry.weather_code != null) {
                    convertJson.weather_code[timeStr] = entry.weather_code;
                }
            }
        }

        convertJson.watt_hours_day[dateKey] = dailyTotal;
    }

    return convertJson;
}

/**
 * Convert adapter azimuth convention to pvnode orientation.
 *
 * Adapter convention: -180=north, -90=east, 0=south, 90=west, 180=north
 * pvnode convention: 0=north, 90=east, 180=south, 270=west
 *
 * @param {number} azimuth - Azimuth in adapter convention
 * @returns {number} Orientation in pvnode convention (degrees from north)
 */
function convertAzimuthToOrientation(azimuth) {
    let orientation = (azimuth + 180) % 360;
    if (orientation < 0) {
        orientation += 360;
    }
    return orientation;
}

module.exports = {
    convertToForecast,
    convertAzimuthToOrientation,
};
