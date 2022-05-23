'use strict';

const moment = require('moment');

// https://docs.solcast.com.au/
function convertToForecast(dataJson) {
	let totalEnergyToday = 0;
	let totalEnergyTomorrow = 0;

	const convertJson = {
		watt_hours: {},
		watts: {},
		watt_hours_day: {}
	};

	for (let index = 0; index < dataJson.forecasts.length; index++) {
		const plantdata = dataJson.forecasts[index];

		const time = plantdata.period_end.replace(/T/g, ' ').replace(/Z/g, '');
		const newtime = moment(time).format('YYYY-MM-DD HH:mm:ss');

		if (Number(moment(time).format('HH')) < 22 && Number(moment(time).format('HH')) > 5) {
			convertJson.watts[newtime] = plantdata.pv_estimate * 1000; // Convert pv_estimate (kW to W)
		}

		if (plantdata.pv_estimate !== 0 && index > 0) {
			if (plantdata.pv_estimate > dataJson.forecasts[index - 1].pv_estimate) {
				convertJson.watt_hours[newtime] = (dataJson.forecasts[index - 1].pv_estimate + ((plantdata.pv_estimate - dataJson.forecasts[index - 1].pv_estimate) / 2)) / 2 * 1000;
			} else if (plantdata.pv_estimate < dataJson.forecasts[index - 1].pv_estimate) {
				convertJson.watt_hours[newtime] = (plantdata.pv_estimate + ((dataJson.forecasts[index - 1].pv_estimate - plantdata.pv_estimate) / 2)) / 2 * 1000;
			}
		} else {
			convertJson.watt_hours[newtime] = 0;
		}

		if ((moment().date() === moment(time).date())) {
			totalEnergyToday += convertJson.watt_hours[newtime];
		} else if ((moment().add(1, 'days').date() === moment(time).date())) {
			totalEnergyTomorrow += convertJson.watt_hours[newtime];
		}
	}

	convertJson.watt_hours_day[moment().format('YYYY-MM-DD')] = totalEnergyToday;
	convertJson.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')] = totalEnergyTomorrow;

	return convertJson;
}

module.exports = {
	convertToForecast: convertToForecast,
};