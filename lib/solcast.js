'use strict';

const moment = require('moment');

function getMomentObj(date, utcOffset) {
    let timeMoment = moment(date);
    if (utcOffset !== undefined) {
        timeMoment = timeMoment.utcOffset(utcOffset);
    }

    return timeMoment;
}

function getForecastForDate(date, dataJson, utcOffset) {
    let totalEnergy = 0;
    const dateJson = {
        watts: {}, // maximum power per hour
        watt_hours_period: {}, // watt hours in that hour
        watt_hours: {}, // cumulated of current day so far
        watt_hours_day: {}
    };

    // Just handle entries of selected date
    const forecastsDate = dataJson.forecasts.filter(forecast => getMomentObj(forecast.period_end, utcOffset).date() == date);
    let wattHours = 0;
    let timeMoment = null;

    for (let i = 0; i < forecastsDate.length; i++) {
        const forecast = forecastsDate[i];
        timeMoment = getMomentObj(forecast.period_end, utcOffset);

        const newtime = timeMoment.format('YYYY-MM-DD HH:mm:ss');

        if (timeMoment.hour() < 22 && timeMoment.hour() > 5) {
            dateJson.watts[newtime] = forecast.pv_estimate * 1000; // Convert pv_estimate (kW to W)
        }

        if (forecast.pv_estimate !== 0 && i > 0) {
            const prevEstimate = forecastsDate[i - 1];

            dateJson.watt_hours_period[newtime] = (prevEstimate.pv_estimate + (forecast.pv_estimate - prevEstimate.pv_estimate) / 2) / 2 * 1000;
        } else {
            dateJson.watt_hours_period[newtime] = 0;
        }

        wattHours += dateJson.watt_hours_period[newtime];
        dateJson.watt_hours[newtime] = wattHours;

        totalEnergy += dateJson.watt_hours_period[newtime];
    }

    if (timeMoment) {
        dateJson.watt_hours_day[timeMoment.format('YYYY-MM-DD')] = totalEnergy;
    }

    return dateJson;
}

// https://docs.solcast.com.au/
function convertToForecast(dataJson, utcOffset) {
    const forecastDates = [];

    for (const forecast of dataJson.forecasts) {
        const timeMoment = getMomentObj(forecast.period_end, utcOffset);

        if (!forecastDates.includes(timeMoment.date())) {
            forecastDates.push(timeMoment.date());
        }
    }

    const convertJson = {
        watts: {}, // maximum power per hour
        watt_hours_period: {}, // watt hours in that hour
        watt_hours: {}, // cumulated of current day so far
        watt_hours_day: {}
    };

    for (const forecastDate of forecastDates) {
        const forecastByDate = getForecastForDate(forecastDate, dataJson, utcOffset);

        convertJson.watts = {...convertJson.watts, ...forecastByDate.watts};
        convertJson.watt_hours_period = {...convertJson.watt_hours_period, ...forecastByDate.watt_hours_period};
        convertJson.watt_hours = {...convertJson.watt_hours, ...forecastByDate.watt_hours};
        convertJson.watt_hours_day = {...convertJson.watt_hours_day, ...forecastByDate.watt_hours_day};
    }

    return convertJson;
}

module.exports = {
    convertToForecast,
};