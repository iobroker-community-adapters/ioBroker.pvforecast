'use strict';

const utils = require('@iobroker/adapter-core');
const moment = require('moment');
const axios = require('axios').default;
const solcast = require(__dirname + '/lib/solcast');
const CronJob = require('cron').CronJob;

const updateInterval = 60 * 10 * 1000; // 10 minutes
let globalunit = 1000;

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

class Pvforecast extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'pvforecast',
		});

		this.globalEveryHour = {};

		this.reqInterval = 60;
		this.hasApiKey = false;

		this.longitude = undefined;
		this.latitude = undefined;

		this.updateServiceDataTimeout = null;
		this.updateActualDataCron = null;

		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	async onReady() {
		this.log.debug(`instance config: ${JSON.stringify(this.config)}`);

		this.longitude = this.config.longitude;
		this.latitude = this.config.latitude;

		if (
			(!this.longitude && this.longitude !== 0) || isNaN(this.longitude) ||
			(!this.latitude && this.latitude !== 0) || isNaN(this.latitude)
		) {
			this.log.debug('longitude and/or latitude not set, loading system configuration');

			try {
				const systemConfigState = await this.getForeignObjectAsync('system.config');
				if (systemConfigState) {
					this.longitude = systemConfigState.common.longitude;
					this.latitude = systemConfigState.common.latitude;

					if (this.longitude && this.latitude) {
						this.log.info(`using system latitude: ${this.latitude} longitude: ${this.longitude}`);
					}
				}
			} catch (err) {
				this.log.error(`error white requesting system.config: ${err}`);
			}
		}

		if (
			this.longitude == '' || typeof this.longitude == 'undefined' || isNaN(this.longitude) ||
			this.latitude == '' || typeof this.latitude == 'undefined' || isNaN(this.latitude)
		) {
			this.log.error('Please set the longitude and latitude in the adapter (or system) configuration!');
			return;
		}

		if (typeof this.config.devices == 'undefined' || !this.config.devices.length) {
			this.log.error('Please set at least one device in the adapter configuration!');
			return;
		} else {
			try {
				const plantArray = this.config.devices;

				// Validate plants
				await asyncForEach(plantArray, async (plant) => {
					if (!plant.name) {
						throw new Error(`Invalid device configuration: Found plant without name`);
					}

					if (isNaN(plant.azimuth)) {
						throw new Error(`Invalid device configuration: Found plant without azimuth`);
					}

					if (isNaN(plant.tilt)) {
						throw new Error(`Invalid device configuration: Found plant with incorrect tilt`);
					}

					if (!plant.peakpower || isNaN(plant.peakpower) || plant.peakpower < 0) {
						throw new Error(`Invalid device configuration: Found plant without peak power`);
					}
				});

				// Get list of valid plants by configuration
				const plantsKeep = plantArray.map(d => `${this.namespace}.plants.${this.cleanNamespace(d.name)}`);

				const plantDevices = await this.getDevicesAsync();
				this.log.debug(`Existing plant devices: ${JSON.stringify(plantDevices)} - configured: ${JSON.stringify(plantsKeep)}`);

				await asyncForEach(plantDevices, async (deviceObj) => {
					if (plantsKeep.indexOf(deviceObj._id) === -1) {
						await this.delObjectAsync(deviceObj._id, { recursive: true });
						this.log.info(`Deleted plant with id: ${deviceObj._id} - (not found in configuration)`);
					}
				});

			} catch (err) {
				this.log.error(err);
				return;
			}
		}

		if (!this.config.intervall || this.config.intervall < 60) {
			this.reqInterval = 60 * 60 * 1000;
			this.log.warn('The interval is set to less than 60 minutes. Please set a higher value in the adapter configuration!');
		} else {
			this.log.debug(`The interval is set to ${this.config.intervall} minutes`);
			this.reqInterval = this.config.intervall * 60 * 1000;
		}

		// Check if API key is configured
		if (this.config.apiKey !== '') {
			this.hasApiKey = true;
		}

		if (this.config.service === 'solcast' && !this.hasApiKey) {
			this.log.error('Please set the API key for Solcast in the adapter configuration!');
			return;
		}

		if (this.config.watt_kw) {
			globalunit = 1;
		}

		await this.subscribeStatesAsync('plants.*');

		await this.createAndDeleteStates();
		await this.updateServiceDataInterval();
		await this.updateActualDataInterval();

		let timeZone = 'Europe/Berlin';

		try {
			timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			this.log.info(`Starting update cron (every 15 Minutes) for timezone: ${timeZone}`);
		} catch (err) {
			this.log.warn(`Unable to get system timezone - fallback to Europe/Berlin`);
		}

		this.updateActualDataCron = new CronJob(
			'*/15 * * * *',
			() => this.updateActualDataInterval(),
			() => this.log.debug('stopped updateActualDataInterval'),
			true,
			timeZone
		);
		this.log.debug(`[updateActualDataCron] next execution: ${this.updateActualDataCron.nextDates()}`);
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state && !state.ack) {
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

			if (id.startsWith(this.namespace)) {
				this.getForeignObjectAsync(id)
					.then(obj => {
						if (obj?.native?.resetId) {
							this.log.debug(`state "${id}" changed - resetting "${obj.native.resetId}" to 0`);
							return this.setStateAsync(obj.native.resetId, { val: 0, ack: true });
						}
					})
					.then(() => {
						this.updateServiceDataInterval();
					})
					.catch(err => {
						this.log.error(err);
					});
			}
		}
	}

	async updateServiceDataInterval() {
		if (this.updateServiceDataTimeout) {
			this.clearTimeout(this.updateServiceDataTimeout);
		}

		await this.updateServiceData();
		await this.getWeather();

		if (this.config.service === 'solcast') {
			this.reqInterval = moment().startOf('day').add(1, 'days').add(1, 'hours').valueOf() - moment().valueOf();
			this.log.debug(`updateServiceDataInterval (solcast) - next service refresh in ${this.reqInterval}ms`);
		}

		this.updateServiceDataTimeout = this.setTimeout(async () => {
			this.updateServiceDataTimeout = null;
			await this.updateServiceDataInterval();
		}, this.reqInterval);
	}

	async updateActualDataInterval() {
		this.log.debug('[updateActualDataInterval] starting update');

		const plantArray = this.config.devices || [];

		const jsonDataSummary = [];
		const jsonTableSummary = [];
		const jsonGraphSummary = [];
		const jsonGraphLabelSummary = [];

		this.globalEveryHour = {};

		let totalPowerNow = 0;
		let totalPowerInstalled = 0;

		let totalEnergyNow = 0;
		let totalEnergyToday = 0;
		let totalEnergyTomorrow = 0;

		await asyncForEach(plantArray, async (plant, index) => {
			const cleanPlantId = this.cleanNamespace(plant.name);

			this.globalEveryHour[cleanPlantId] = [];

			const serviceDataState = await this.getStateAsync(`plants.${cleanPlantId}.service.data`);
			if (serviceDataState && serviceDataState.val) {
				try {
					const data = JSON.parse(serviceDataState.val);

					// cancel if no data
					if (typeof data === 'undefined') {
						return;
					}

					this.log.debug(`[updateActualDataInterval] current service data for plants.${cleanPlantId}.service.data ("${plant.name}"): ${JSON.stringify(data)}`);

					for (const time in data.watts) {
						if (this.config.everyhourEnabled) {
							this.saveEveryHour(cleanPlantId, `plants.${cleanPlantId}.power.hoursToday`, moment().date(), time, data.watts[time] / globalunit);
							this.saveEveryHour(cleanPlantId, `plants.${cleanPlantId}.power.hoursTomorrow`, moment().add(1, 'days').date(), time, data.watts[time] / globalunit);
						}

						// add to InfluxDB
						await this.addToInfluxDB(`plants.${cleanPlantId}.power`, moment(time).valueOf(), data.watts[time] / globalunit);
					}

					const powerNow = Object.keys(data.watts)
						.filter((timeStr) => moment(timeStr).valueOf() < moment().valueOf())
						.map(key => data.watts[key])
						.pop() || 0;

					const energyToday = data.watt_hours_day[moment().format('YYYY-MM-DD')];
					const energyTomorrow = data.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')];
					const energyNow = Object.keys(data.watt_hours)
						.filter((timeStr) => moment(timeStr).valueOf() < moment().valueOf())
						.map(key => data.watt_hours[key])
						.pop() || 0;

					totalPowerNow += powerNow;
					totalPowerInstalled += plant.peakpower;
					totalEnergyNow += energyNow;
					totalEnergyToday += energyToday;
					totalEnergyTomorrow += energyTomorrow;

					await this.setStateChangedAsync(`plants.${cleanPlantId}.power.now`, { val: Number(powerNow / globalunit), ack: true });
					await this.setStateChangedAsync(`plants.${cleanPlantId}.power.installed`, { val: plant.peakpower, ack: true });
					await this.setStateChangedAsync(`plants.${cleanPlantId}.energy.now`, { val: Number(energyNow / globalunit), ack: true });
					await this.setStateChangedAsync(`plants.${cleanPlantId}.energy.today`, { val: Number(energyToday / globalunit), ack: true });
					await this.setStateChangedAsync(`plants.${cleanPlantId}.energy.tomorrow`, { val: Number(energyTomorrow / globalunit), ack: true });
					await this.setStateChangedAsync(`plants.${cleanPlantId}.name`, { val: plant.name, ack: true });

					if (this.config.everyhourEnabled) {
						this.saveEveryHourEmptyStates(cleanPlantId, `plants.${cleanPlantId}.power.hoursToday`, moment().date());
						this.saveEveryHourEmptyStates(cleanPlantId, `plants.${cleanPlantId}.power.hoursTomorrow`, moment().add(1, 'days').date());
					}

					// JSON Data
					const jsonData = [];
					for (const time in data.watts) {
						const power = data.watts[time] / globalunit;
						const timestamp = moment(time).valueOf();

						jsonData.push(
							{
								t: timestamp,
								y: power
							}
						);

						if (jsonDataSummary?.[timestamp] === undefined) {
							jsonDataSummary[timestamp] = 0;
						}

						jsonDataSummary[timestamp] += power;
					}

					this.log.debug(`generated JSON data of "${plant.name}": ${JSON.stringify(jsonData)}`);
					await this.setStateAsync(`plants.${cleanPlantId}.JSONData`, { val: JSON.stringify(jsonData), ack: true });

					// JSON Table
					const jsonTable = [];
					let wattindex = 0;
					for (const time in data.watts) {
						const power = data.watts[time] / globalunit;

						jsonTable.push(
							{
								Time: time,
								Power: this.formatValue(power, this.config.watt_kw ? 0 : 3)
							}
						);

						if (index === 0) {
							jsonTableSummary[wattindex] = { 'Time': time };
							jsonTableSummary[wattindex]['Total'] = power;
						} else {
							jsonTableSummary[wattindex]['Total'] = jsonTableSummary[wattindex]['Total'] + power;
						}

						jsonTableSummary[wattindex][plant.name] = this.formatValue(power, this.config.watt_kw ? 0 : 3);
						wattindex++;
					}

					this.log.debug(`generated JSON table of "${plant.name}": ${JSON.stringify(jsonTable)}`);
					await this.setStateAsync(`plants.${cleanPlantId}.JSONTable`, { val: JSON.stringify(jsonTable), ack: true });

					// JSON Graph
					if (this.config.chartingEnabled) {
						const jsonGraphData = [];
						const jsonGraphLabels = [];

						for (const time in data.watts) {
							const timeMoment = moment(time);

							if (!this.config.chartingJustToday || timeMoment.date() === moment().date()) {
								const timeInCustomFormat = timeMoment.format(this.config.chartingLabelFormat);

								// Add label if not exists
								if (jsonGraphLabelSummary.indexOf(timeInCustomFormat) < 0) {
									jsonGraphLabelSummary.push(timeInCustomFormat);
								}

								jsonGraphLabels.push(timeInCustomFormat);
								jsonGraphData.push(data.watts[time] / globalunit);
							}
						}

						// https://github.com/Scrounger/ioBroker.vis-materialdesign/blob/master/README.md
						const jsonGraph = {
							// graph
							data: jsonGraphData,
							type: 'bar',
							legendText: plant.name,
							displayOrder: index + 1,
							color: plantArray[index].graphcolor,
							tooltip_AppendText: this.config.watt_kw ? 'W' : 'kW',
							//datalabel_append: this.config.watt_kw ? 'W' : 'kW',
							datalabel_show: true,
							datalabel_rotation: this.config.chartingRoation,
							datalabel_color: plantArray[index].labelcolor,
							datalabel_fontSize: this.config.chartingLabelSize,

							// graph bar chart spfeicifc
							barIsStacked: true,
							barStackId: 1,

							// graph y-Axis
							yAxis_id: 0,
							yAxis_position: 'left',
							yAxis_show: true,
							yAxis_appendix: this.config.watt_kw ? 'W' : 'kW',
							yAxis_step: this.config.chartingAxisStepY,
						};

						jsonGraphSummary.push(jsonGraph);

						this.log.debug(`generated JSON graph of "${plant.name}": ${JSON.stringify(jsonGraph)}`);
						await this.setStateAsync(`plants.${cleanPlantId}.JSONGraph`, { val: JSON.stringify({ 'graphs': [jsonGraph], 'axisLabels': jsonGraphLabels }), ack: true });
					} else {
						await this.setStateAsync(`plants.${cleanPlantId}.JSONGraph`, { val: JSON.stringify({}), ack: true });
					}

					await this.setStateAsync(`plants.${cleanPlantId}.lastUpdated`, { val: moment().valueOf(), ack: true });

					this.log.debug(`finished plant update: "${plant.name}"`);
				} catch (err) {
					this.log.debug(`unable to update "${plant.name}": ${err}`);
				}
			}
		});

		this.log.debug('finished plants update');

		if (this.config.everyhourEnabled) {
			await this.saveEveryHourSummary('summary.power.hoursToday', moment().date());
			await this.saveEveryHourSummary('summary.power.hoursTomorrow', moment().add(1, 'days').date());
			this.log.debug(`global time: ${JSON.stringify(this.globalEveryHour)}`);
		}

		await this.setStateChangedAsync('summary.power.now', { val: Number(totalPowerNow / globalunit), ack: true });
		await this.setStateChangedAsync('summary.power.installed', { val: totalPowerInstalled, ack: true });
		await this.setStateChangedAsync('summary.energy.now', { val: Number(totalEnergyNow / globalunit), ack: true });
		await this.setStateChangedAsync('summary.energy.today', { val: Number(totalEnergyToday / globalunit), ack: true });
		await this.setStateChangedAsync('summary.energy.tomorrow', { val: Number(totalEnergyTomorrow / globalunit), ack: true });

		// add summary to InfluxDB
		await asyncForEach(Object.keys(jsonDataSummary), async (time) => {
			await this.addToInfluxDB(`summary.power`, Number(time), jsonDataSummary[time]);
		});

		// JSON Data
		const jsonDataSummaryFormat = Object.keys(jsonDataSummary).map(time => {
			return {
				t: Number(time),
				y: jsonDataSummary[time]
			};
		});
		await this.setStateAsync('summary.JSONData', { val: JSON.stringify(jsonDataSummaryFormat), ack: true });

		// JSON Table
		const jsonTableSummaryFormat = jsonTableSummary.map(row => {
			row['Total'] = this.formatValue(row['Total'], this.config.watt_kw ? 0 : 3);
			return row;
		});
		await this.setStateAsync('summary.JSONTable', { val: JSON.stringify(jsonTableSummaryFormat), ack: true });

		// JSON Graph
		if (this.config.chartingEnabled) {
			await this.setStateAsync('summary.JSONGraph', { val: JSON.stringify({ 'graphs': jsonGraphSummary, 'axisLabels': jsonGraphLabelSummary }), ack: true });
		} else {
			await this.setStateAsync('summary.JSONGraph', { val: JSON.stringify({}), ack: true });
		}

		await this.setStateAsync('summary.lastUpdated', { val: moment().valueOf(), ack: true });

		await this.updateWeatherData();
	}

	// analysis weather data
	async updateWeatherData() {
		if (this.hasApiKey && this.config.weatherEnabled) {
			try {
				const serviceDataState = await this.getStateAsync('weather.service.data');
				if (serviceDataState && serviceDataState.val) {
					const data = JSON.parse(serviceDataState.val);

					const lowerTimeLimit = moment().subtract(updateInterval / 2, 'ms');
					const upperTimeLimit = moment().add(updateInterval / 2, 'ms');

					this.log.debug(`[updateWeatherData] searching for weather information between ${lowerTimeLimit.format('DD.MM.YYYY HH:mm:ss')} and ${upperTimeLimit.format('DD.MM.YYYY HH:mm:ss')}`);

					for (let i = 0; i < data.length; i++) {

						const weatherEntryTimestamp = moment(data[i].datetime).valueOf();

						if (lowerTimeLimit.valueOf() < weatherEntryTimestamp && upperTimeLimit.valueOf() > weatherEntryTimestamp) {
							this.log.debug(`[updateWeatherData] filling states with weather info from: ${JSON.stringify(data[i])}`);

							await this.setStateChangedAsync('weather.sky', { val: Number(data[i].sky), ack: true });
							await this.setStateChangedAsync('weather.datetime', { val: weatherEntryTimestamp, ack: true });
							await this.setStateChangedAsync('weather.visibility', { val: Number(data[i].visibility), ack: true });
							await this.setStateChangedAsync('weather.temperature', { val: Number(data[i].temperature), ack: true });
							await this.setStateChangedAsync('weather.condition', { val: data[i].condition, ack: true });
							await this.setStateChangedAsync('weather.icon', { val: data[i].icon, ack: true });
							await this.setStateChangedAsync('weather.wind_speed', { val: Number(data[i].wind_speed), ack: true });
							await this.setStateChangedAsync('weather.wind_degrees', { val: Number(data[i].wind_degrees), ack: true });
							await this.setStateChangedAsync('weather.wind_direction', { val: data[i].wind_direction, ack: true });
						} else {
							this.log.debug(`[updateWeatherData] ${weatherEntryTimestamp} is not between ${lowerTimeLimit} and ${upperTimeLimit}`);
						}
					}
				}

			} catch (err) {
				this.log.error(`[updateWeatherData] failed to update weather data: ${err}`);
			}
		}
	}

	async getWeather() {
		try {
			if (this.hasApiKey && this.config.weatherEnabled) {
				if (this.config.service === 'forecastsolar') {

					// https://api.forecast.solar/:key/weather/:lat/:lon (Professional account only)
					const url = `https://api.forecast.solar/${this.config.apiKey}/weather/${this.latitude}/${this.longitude}`;
					this.log.debug(`[getWeather] url (professional account only): ${url}`);

					try {
						const serviceResponse = await axios.get(url);

						this.log.debug(`[getWeather] received data: ${JSON.stringify(serviceResponse.data)}`);

						if (serviceResponse) {
							await this.setStateAsync('weather.service.data', { val: JSON.stringify(serviceResponse.data.result), ack: true });
							await this.setStateAsync(`weather.service.lastUpdated`, { val: moment().valueOf(), ack: true });
						}

					} catch (error) {
						if (error === 'Error: Request failed with status code 429') {
							this.log.error('too many data requests');
						} else if (error === 'Error: Request failed with status code 400') {
							this.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
						} else {
							this.log.error('Axios Error ' + error);
						}
					}
				} else {
					this.log.warn(`[getWeather] weather data is just available for "forecastsolar"`);
				}
			}
		} catch (err) {
			this.log.error(`[getWeather] error: ${err}`);
		}
	}

	async updateServiceData() {
		const plantArray = this.config.devices || [];

		await asyncForEach(plantArray, async (plant) => {
			const cleanPlantId = this.cleanNamespace(plant.name);

			let url = '';
			if (this.config.service === 'forecastsolar') {
				if (this.hasApiKey) {
					// https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec/:az/:kwp
					url = `https://api.forecast.solar/${this.config.apiKey}/estimate/${this.latitude}/${this.longitude}/${plant.tilt}/${plant.azimuth}/${plant.peakpower}`;
				} else {
					// https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
					url = `https://api.forecast.solar/estimate/${this.latitude}/${this.longitude}/${plant.tilt}/${plant.azimuth}/${plant.peakpower}`;
				}
			} else if (this.config.service === 'solcast') {
				url = `https://api.solcast.com.au/world_pv_power/forecasts?format=json&hours=48&loss_factor=1&latitude=${this.latitude}&longitude=${this.longitude}&tilt=${plant.tilt}&azimuth=${this.convertAzimuth(plant.azimuth)}&capacity=${plant.peakpower}&api_key=${this.config.apiKey}`;
			}

			if (url) {
				// Force update when url changed
				const serviceDataUrlState = await this.getStateAsync(`plants.${cleanPlantId}.service.url`);
				const lastUrl = (serviceDataUrlState && serviceDataUrlState.val) ? serviceDataUrlState.val : '';

				const serviceDataLastUpdatedState = await this.getStateAsync(`plants.${cleanPlantId}.service.lastUpdated`);
				const lastUpdate = (serviceDataLastUpdatedState && serviceDataLastUpdatedState.val) ? Number(serviceDataLastUpdatedState.val) : 0;

				this.log.debug(`plant "${plant.name}" - last update: ${lastUpdate}, service url: ${url}`);

				if (lastUrl !== url || !lastUpdate || moment().valueOf() - lastUpdate > 60 * 60 * 1000) {
					try {
						this.log.debug(`Starting update of ${plant.name}`);

						const serviceResponse = await axios.get(url);

						this.log.debug(`received "${this.config.service}" data for plant "${plant.name}": ${JSON.stringify(serviceResponse.data)}`);

						let data;
						let message;

						if (this.config.service === 'forecastsolar') {
							data = serviceResponse.data.result;
							message = serviceResponse.data.message;

							this.log.debug(`rate limit for forecastsolar API: ${message.ratelimit.limit} (${message.ratelimit.remaining} left in period)`);

						} else if (this.config.service === 'solcast') {
							data = solcast.convertToForecast(serviceResponse.data);
							this.log.debug(`[parseSolcastToForecast] converted JSON: ${JSON.stringify(data)}`);

							message = { 'info': { 'place': '-' }, 'type': 'Solcast' };
						}

						await this.setStateAsync(`plants.${cleanPlantId}.service.url`, { val: url, ack: true });
						await this.setStateAsync(`plants.${cleanPlantId}.service.data`, { val: JSON.stringify(data), ack: true });
						await this.setStateAsync(`plants.${cleanPlantId}.service.lastUpdated`, { val: moment().valueOf(), ack: true });
						await this.setStateAsync(`plants.${cleanPlantId}.service.message`, { val: message.type, ack: true });
						await this.setStateAsync(`plants.${cleanPlantId}.place`, { val: message.info.place, ack: true });

					} catch (error) {
						if (error === 'Error: Request failed with status code 429') {
							this.log.error('too many data requests');
						} else if (error === 'Error: Request failed with status code 400') {
							this.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
						} else if (error === 'Error: Request failed with status code 404') {
							this.log.error('Error: Not Found');
						} else if (error === 'Error: Request failed with status code 502') {
							this.log.error('Error: Bad Gateway');
						} else {
							this.log.error('Axios Error ' + error);
						}
					}

				} else {
					this.log.debug(`Last update of "${plant.name}" is within refresh interval - skipping`);
				}

				this.log.debug('received all data');
			}
		});
	}

	async saveEveryHour(cleanPlantId, prefix, dayOfMonth, timeStr, value) {
		// timeStr example: "2022-05-23 17:30:00"
		const timeObj = moment(timeStr);
		const hourKey = timeObj.format('HH:mm:ss');

		if (this.getValidHourKeys().includes(hourKey) && dayOfMonth === moment(timeStr).date()) {
			this.log.debug(`[saveEveryHour] found time ${prefix}.${hourKey} - value: ${value}`);

			await this.setStateChangedAsync(`${prefix}.${hourKey}`, { val: Number(value), ack: true });

			this.globalEveryHour[cleanPlantId].push({dayOfMonth: dayOfMonth, time: hourKey, value: Number(value) });
		} else {
			this.log.silly(`[saveEveryHour] no match for plant "${cleanPlantId}" at "${timeStr}" (${moment().date()} !== ${moment(timeStr).date()})`);
		}
	}

	async saveEveryHourEmptyStates(cleanPlantId, prefix, dayOfMonth) {
		const validHourKeys = this.getValidHourKeys();
		const filledHourKeys = this.globalEveryHour[cleanPlantId].filter(e => e.dayOfMonth == dayOfMonth).map(e => e.time);
		const unfilledHourKeys = validHourKeys.filter(hourKey => filledHourKeys.indexOf(hourKey) < 0);

		this.log.debug(`[saveEveryHourEmptyStates] ${unfilledHourKeys.length} items missing - please check if your license allows to request all values`);

		// Fill all hours with 0 (which were not included in the service data)
		await asyncForEach(unfilledHourKeys, async (hourKey) => {
			await this.setStateChangedAsync(`${prefix}.${hourKey}`, { val: 0, ack: true, q: 0x02 });
		});
	}

	async saveEveryHourSummary(prefix, dayOfMonth) {
		const plantArray = this.config.devices || [];

		const validHourKeys = this.getValidHourKeys();

		await asyncForEach(validHourKeys, async (hourKey) => {
			let totalPower = 0;

			await asyncForEach(plantArray, async (plant) => {
				const cleanPlantId = this.cleanNamespace(plant.name);
				totalPower += this.globalEveryHour[cleanPlantId]
					.filter(e => e.dayOfMonth == dayOfMonth && e.time === hourKey)
					.reduce((pv, cv) => pv + cv.value, 0);
			});

			await this.setStateChangedAsync(`${prefix}.${hourKey}`, { val: totalPower, ack: true });
		});
	}

	async addToInfluxDB(datapoint, timestamp, value) {
		try {
			let influxInstance = this.config.influxinstace;

			if (!influxInstance) return;

			// Fallback for older instance configs
			if (!influxInstance.startsWith('influxdb.')) {
				influxInstance = `influxdb.${influxInstance}`;
			}

			this.log.silly(`[addToInfluxDB] storeState into "${influxInstance}": value "${value}" (${typeof value}) of "${this.namespace}.${datapoint}" with timestamp ${timestamp}`);

			const result = await this.sendToAsync(influxInstance, 'storeState', {
				id: `${this.namespace}.${datapoint}`,
				state: {
					ts: timestamp,
					val: value,
					ack: true,
					from: `system.adapter.${this.namespace}`,
					//q: 0
				}
			});

			this.log.silly(`[addToInfluxDB] storeState result: ${JSON.stringify(result)}`);
		} catch (err) {
			this.log.error(`[addToInfluxDB] storeState error: ${err}`);
		}
	}

	async createAndDeleteStates() {
		try {
			if (this.hasApiKey && this.config.weatherEnabled) {
				this.log.debug('creating states for weather');

				await this.setObjectNotExistsAsync('weather', {
					type: 'channel',
					common: {
						name: {
							en: 'Weather',
							de: 'Wetter',
							ru: 'Погода',
							pt: 'Clima',
							nl: 'Het weer',
							fr: 'Temps',
							it: 'Tempo metereologico',
							es: 'Tiempo',
							pl: 'Pogoda',
							'zh-cn': '天气'
						}
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.service', {
					type: 'channel',
					common: {
						name: {
							en: 'API',
							de: 'API',
							ru: 'API',
							pt: 'API',
							nl: 'API',
							fr: 'API',
							it: 'API',
							es: 'API',
							pl: 'API',
							'zh-cn': 'API'
						}
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.service.data', {
					type: 'state',
					common: {
						name: {
							en: 'Weather data from service',
							de: 'Wetterdaten vom Dienst',
							ru: 'Данные о погоде от сервиса',
							pt: 'Dados meteorológicos do serviço',
							nl: 'Weergegevens van service',
							fr: 'Données météorologiques du service',
							it: 'Dati meteorologici dal servizio',
							es: 'Datos meteorológicos del servicio',
							pl: 'Dane pogodowe z serwisu',
							'zh-cn': '来自服务的天气数据'
						},
						type: 'string',
						role: 'weather.json',
						read: true,
						write: false,
						def: '{}'
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`weather.service.lastUpdated`, {
					type: 'state',
					common: {
						name: {
							en: 'Last update (service)',
							de: 'Letztes Update (Service)',
							ru: 'Последнее обновление (сервис)',
							pt: 'Última atualização (serviço)',
							nl: 'Laatste update (service)',
							fr: 'Dernière mise à jour (service)',
							it: 'Ultimo aggiornamento (servizio)',
							es: 'Última actualización (servicio)',
							pl: 'Ostatnia aktualizacja (usługa)',
							'zh-cn': '最后更新（服务）'
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.datetime', {
					type: 'state',
					common: {
						name: {
							en: 'Timestamp',
							de: 'Zeitstempel',
							ru: 'Отметка времени',
							pt: 'Carimbo de data e hora',
							nl: 'Tijdstempel',
							fr: 'Horodatage',
							it: 'Timestamp',
							es: 'marca de tiempo',
							pl: 'Znak czasu',
							'zh-cn': '时间戳'
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.sky', {
					type: 'state',
					common: {
						name: {
							en: 'Sky',
							de: 'Himmel',
							ru: 'Небо',
							pt: 'Céu',
							nl: 'Lucht',
							fr: 'Ciel',
							it: 'Cielo',
							es: 'Cielo',
							pl: 'Niebo',
							'zh-cn': '天空'
						},
						type: 'number',
						role: 'value',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.visibility', {
					type: 'state',
					common: {
						name: {
							en: 'Visibility',
							de: 'Sichtweite',
							ru: 'Видимость',
							pt: 'Visibilidade',
							nl: 'Zichtbaarheid',
							fr: 'Visibilité',
							it: 'Visibilità',
							es: 'Visibilidad',
							pl: 'Widoczność',
							'zh-cn': '能见度'
						},
						type: 'number',
						role: 'value',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.temperature', {
					type: 'state',
					common: {
						name: {
							en: 'Temperature',
							de: 'Temperatur',
							ru: 'Температура',
							pt: 'Temperatura',
							nl: 'Temperatuur',
							fr: 'Température',
							it: 'Temperatura',
							es: 'Temperatura',
							pl: 'Temperatura',
							'zh-cn': '温度'
						},
						type: 'number',
						role: 'value.temperature',
						unit: '°C',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.condition', {
					type: 'state',
					common: {
						name: {
							en: 'Weather condition',
							de: 'Wetterlage',
							ru: 'Погодные условия',
							pt: 'Condições meteorológicas',
							nl: 'Weerconditie',
							fr: 'Les conditions météorologiques',
							it: 'Condizioni metereologiche',
							es: 'Condición climática',
							pl: 'Stan pogody',
							'zh-cn': '气候条件'
						},
						type: 'string',
						role: 'value.condition',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.icon', {
					type: 'state',
					common: {
						name: {
							en: 'Icon',
							de: 'Symbol',
							ru: 'Значок',
							pt: 'Ícone',
							nl: 'Icoon',
							fr: 'Icône',
							it: 'Icona',
							es: 'Icono',
							pl: 'Ikona',
							'zh-cn': '图标'
						},
						type: 'string',
						role: 'weather.icon',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.wind_speed', {
					type: 'state',
					common: {
						name: {
							en: 'Wind speed',
							de: 'Windgeschwindigkeit',
							ru: 'Скорость ветра',
							pt: 'Velocidade do vento',
							nl: 'Windsnelheid',
							fr: 'Vitesse du vent',
							it: 'Velocità del vento',
							es: 'Velocidad del viento',
							pl: 'Prędkość wiatru',
							'zh-cn': '风速'
						},
						type: 'number',
						role: 'value.speed.wind',
						unit: 'km/h',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.wind_degrees', {
					type: 'state',
					common: {
						name: {
							en: 'Wind direction (degrees)',
							de: 'Windrichtung (Grad)',
							ru: 'Направление ветра (градусы)',
							pt: 'Direção do vento (graus)',
							nl: 'Windrichting (graden)',
							fr: 'Direction du vent (degrés)',
							it: 'Direzione del vento (gradi)',
							es: 'Dirección del viento (grados)',
							pl: 'Kierunek wiatru (stopnie)',
							'zh-cn': '风向（度）'
						},
						type: 'number',
						role: 'value',
						unit: '°',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync('weather.wind_direction', {
					type: 'state',
					common: {
						name: {
							en: 'Wind direction',
							de: 'Windrichtung',
							ru: 'Направление ветра',
							pt: 'Direção do vento',
							nl: 'Windrichting',
							fr: 'Direction du vent',
							it: 'La direzione del vento',
							es: 'Dirección del viento',
							pl: 'Kierunek wiatru',
							'zh-cn': '风向'
						},
						type: 'string',
						role: 'value.direction.wind',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
			} else {
				await this.delObjectAsync('weather', { recursive: true });
			}

			const plantArray = this.config.devices;

			await asyncForEach(plantArray, async (plant) => {
				const cleanPlantId = this.cleanNamespace(plant.name);

				this.log.debug(`creating states for plant: "${plant.name}" (${cleanPlantId})`);

				await this.extendObjectAsync(`plants.${cleanPlantId}`, {
					type: 'device',
					common: {
						name: plant.name
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.power`, {
					type: 'channel',
					common: {
						name: {
							en: 'Estimated power',
							de: 'Geschätzte Leistung',
							ru: 'Расчетная мощность',
							pt: 'Potência estimada',
							nl: 'Geschat vermogen',
							fr: 'Puissance estimée',
							it: 'Potenza stimata',
							es: 'Potencia estimada',
							pl: 'Szacowana moc',
							'zh-cn': '估计功率'
						}
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.power.now`, {
					type: 'state',
					common: {
						name: {
							en: 'Estimated power (now)',
							de: 'Geschätzte Leistung (jetzt)',
							ru: 'Расчетная мощность (сейчас)',
							pt: 'Potência estimada (agora)',
							nl: 'Geschat vermogen (nu)',
							fr: 'Puissance estimée (maintenant)',
							it: 'Potenza stimata (ora)',
							es: 'Potencia estimada (ahora)',
							pl: 'Szacowana moc (teraz)',
							'zh-cn': '估计功率（现在）'
						},
						type: 'number',
						role: 'value',
						unit: 'kW',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.power.installed`, {
					type: 'state',
					common: {
						name: {
							en: 'Total power installed',
							de: 'Gesamtleistung installiert',
							ru: 'Общая установленная мощность',
							pt: 'Potência total instalada',
							nl: 'Totaal geïnstalleerd vermogen',
							fr: 'Puissance totale installée',
							it: 'Potenza totale installata',
							es: 'Potencia total instalada',
							pl: 'Całkowita moc zainstalowana',
							'zh-cn': '总装机功率'
						},
						type: 'number',
						role: 'value',
						unit: 'kWp',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.energy`, {
					type: 'channel',
					common: {
						name: {
							en: 'Estimated energy',
							de: 'Geschätzte Energie',
							ru: 'Расчетная энергия',
							pt: 'Energia estimada',
							nl: 'geschatte energie',
							fr: 'Énergie estimée',
							it: 'Energia stimata',
							es: 'Energía estimada',
							pl: 'Szacowana energia',
							'zh-cn': '估计能量'
						}
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.energy.now`, {
					type: 'state',
					common: {
						name: {
							en: 'Estimated energy (today until now)',
							de: 'Geschätzte Energie (heute bis jetzt)',
							ru: 'Расчетная энергия (сегодня по настоящее время)',
							pt: 'Energia estimada (hoje até agora)',
							nl: 'Geschatte energie (vandaag tot nu)',
							fr: 'Énergie estimée (aujourd\'hui jusqu\'à maintenant)',
							it: 'Energia stimata (da oggi ad oggi)',
							es: 'Energía estimada (hoy hasta ahora)',
							pl: 'Szacowana energia (dzisiaj do teraz)',
							'zh-cn': '估计能量（今天到现在）'
						},
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.energy.today`, {
					type: 'state',
					common: {
						name: {
							en: 'Estimated energy (today)',
							de: 'Geschätzte Energie (heute)',
							ru: 'Расчетная энергия (сегодня)',
							pt: 'Energia estimada (hoje)',
							nl: 'Geschatte energie (vandaag)',
							fr: 'Énergie estimée (aujourd\'hui)',
							it: 'Energia stimata (oggi)',
							es: 'Energía estimada (hoy)',
							pl: 'Szacowana energia (dzisiaj)',
							'zh-cn': '估计能量（今天）'
						},
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.energy.tomorrow`, {
					type: 'state',
					common: {
						name: {
							en: 'Estimated energy (tomorrow)',
							de: 'Geschätzte Energie (morgen)',
							ru: 'Расчетная энергия (завтра)',
							pt: 'Energia estimada (amanhã)',
							nl: 'Geschatte energie (morgen)',
							fr: 'Énergie estimée (demain)',
							it: 'Energia stimata (domani)',
							es: 'Energía estimada (mañana)',
							pl: 'Szacowana energia (jutro)',
							'zh-cn': '估计能量（明天）'
						},
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.name`, {
					type: 'state',
					common: {
						name: {
							en: 'Solar plant name',
							de: 'Name der Solaranlage',
							ru: 'Название солнечной электростанции',
							pt: 'Nome da planta solar',
							nl: 'naam zonne-installatie:',
							fr: 'Nom de la centrale solaire',
							it: 'Nome dell\'impianto solare',
							es: 'nombre de la planta solar',
							pl: 'Nazwa elektrowni słonecznej',
							'zh-cn': '太阳能电站名称'
						},
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service`, {
					type: 'channel',
					common: {
						name: {
							en: 'API',
							de: 'API',
							ru: 'API',
							pt: 'API',
							nl: 'API',
							fr: 'API',
							it: 'API',
							es: 'API',
							pl: 'API',
							'zh-cn': 'API'
						}
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service.url`, {
					type: 'state',
					common: {
						name: {
							en: 'Service url',
							de: 'Service-URL',
							ru: 'URL службы',
							pt: 'URL de serviço',
							nl: 'Service-URL',
							fr: 'URL du service',
							it: 'URL di servizio',
							es: 'URL del servicio',
							pl: 'URL usługi',
							'zh-cn': '服务网址'
						},
						type: 'string',
						role: 'text',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service.data`, {
					type: 'state',
					common: {
						name: {
							en: 'Forcast data from service',
							de: 'Prognosedaten vom Dienst',
							ru: 'Прогноз данных от сервиса',
							pt: 'Dados de previsão do serviço',
							nl: 'Voorspel gegevens van service',
							fr: 'Prévision des données du service',
							it: 'Previsione dei dati dal servizio',
							es: 'Pronosticar datos del servicio',
							pl: 'Przewiduj dane z usługi',
							'zh-cn': '来自服务的预测数据'
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service.lastUpdated`, {
					type: 'state',
					common: {
						name: {
							en: 'Last update (service)',
							de: 'Letztes Update (Service)',
							ru: 'Последнее обновление (сервис)',
							pt: 'Última atualização (serviço)',
							nl: 'Laatste update (service)',
							fr: 'Dernière mise à jour (service)',
							it: 'Ultimo aggiornamento (servizio)',
							es: 'Última actualización (servicio)',
							pl: 'Ostatnia aktualizacja (usługa)',
							'zh-cn': '最后更新（服务）'
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service.message`, {
					type: 'state',
					common: {
						name: {
							en: 'Transferred message',
							de: 'Übertragene Nachricht',
							ru: 'Передано сообщение',
							pt: 'Mensagem transferida',
							nl: 'Overgedragen bericht',
							fr: 'Message transféré',
							it: 'Messaggio trasferito',
							es: 'mensaje transferido',
							pl: 'Przeniesiona wiadomość',
							'zh-cn': '转移的消息'
						},
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.service.refresh`, {
					type: 'state',
					common: {
						name: {
							en: 'Force refresh',
							de: 'Aktualisieren erzwingen',
							ru: 'Принудительное обновление',
							pt: 'Forçar atualização',
							nl: 'Vernieuwen forceren',
							fr: 'Forcer l\'actualisation',
							it: 'Forza l\'aggiornamento',
							es: 'Forzar actualización',
							pl: 'Wymuś odświeżenie',
							'zh-cn': '强制刷新'
						},
						type: 'boolean',
						role: 'button',
						read: false,
						write: true
					},
					native: {
						resetId: `plants.${cleanPlantId}.service.lastUpdated`
					}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.place`, {
					type: 'state',
					common: {
						name: {
							en: 'Location information',
							de: 'Standortinformationen',
							ru: 'Информация о местонахождении',
							pt: 'Informações de localização',
							nl: 'Locatie informatie',
							fr: 'Information de Lieu',
							it: 'Informazioni sulla posizione',
							es: 'Información sobre la ubicación',
							pl: 'Informacje lokalne',
							'zh-cn': '地点信息'
						},
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.lastUpdated`, {
					type: 'state',
					common: {
						name: {
							en: 'Last update (data)',
							de: 'Letztes Update (Daten)',
							ru: 'Последнее обновление (данные)',
							pt: 'Última atualização (dados)',
							nl: 'Laatste update (gegevens)',
							fr: 'Dernière mise à jour (données)',
							it: 'Ultimo aggiornamento (dati)',
							es: 'Última actualización (datos)',
							pl: 'Ostatnia aktualizacja (dane)',
							'zh-cn': '上次更新（数据）'
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.JSONData`, {
					type: 'state',
					common: {
						name: {
							en: 'JSON Data',
							de: 'JSON Daten',
							ru: 'ДЖСОН Данные',
							pt: 'J. Dados',
							nl: 'JSON Data',
							fr: 'JSON Données',
							it: 'JSON Dati',
							es: 'JSON Datos',
							pl: 'JSON Data',
							'zh-cn': '附 件 数据'
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						def: '{}'
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.JSONGraph`, {
					type: 'state',
					common: {
						name: {
							en: 'Graph data in JSON format',
							de: 'Diagrammdaten im JSON-Format',
							ru: 'Графические данные в формате JSON',
							pt: 'Dados do gráfico no formato JSON',
							nl: 'Grafiekgegevens in JSON-indeling',
							fr: 'Données de graphique au format JSON',
							it: 'Dati grafici in formato JSON',
							es: 'Graficar datos en formato JSON',
							pl: 'Dane wykresu w formacie JSON',
							'zh-cn': 'JSON格式的图形数据'
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						def: '{}'
					},
					native: {}
				});

				await this.setObjectNotExistsAsync(`plants.${cleanPlantId}.JSONTable`, {
					type: 'state',
					common: {
						name: {
							en: 'Table data in JSON format',
							de: 'Tabellendaten im JSON-Format',
							ru: 'Табличные данные в формате JSON',
							pt: 'Dados da tabela no formato JSON',
							nl: 'Tabelgegevens in JSON-indeling',
							fr: 'Données de table au format JSON',
							it: 'Dati della tabella in formato JSON',
							es: 'Tabla de datos en formato JSON',
							pl: 'Dane tabeli w formacie JSON',
							'zh-cn': 'JSON格式的表格数据'
						},
						type: 'string',
						role: 'json',
						read: true,
						write: false,
						def: '{}'
					},
					native: {}
				});

				// update unit by config
				await this.extendObjectAsync(`plants.${cleanPlantId}.power.now`, {
					common: {
						unit: this.config.watt_kw ? 'W' : 'kW'
					}
				});
				await this.extendObjectAsync(`plants.${cleanPlantId}.energy.now`, {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});
				await this.extendObjectAsync(`plants.${cleanPlantId}.energy.today`, {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});
				await this.extendObjectAsync(`plants.${cleanPlantId}.energy.tomorrow`, {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});

				if (this.config.everyhourEnabled) {
					await this.createHoursStates(`plants.${cleanPlantId}.power.hoursToday`);
					await this.createHoursStates(`plants.${cleanPlantId}.power.hoursTomorrow`);
				} else {
					// Delete states
					await this.delObjectAsync(`plants.${cleanPlantId}.power.hoursToday`, { recursive: true });
					await this.delObjectAsync(`plants.${cleanPlantId}.power.hoursTomorrow`, { recursive: true });
				}
			});

			// update unit by config
			await this.extendObjectAsync('summary.power.now', {
				common: {
					unit: this.config.watt_kw ? 'W' : 'kW'
				}
			});
			await this.extendObjectAsync('summary.energy.now', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});
			await this.extendObjectAsync('summary.energy.today', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});
			await this.extendObjectAsync('summary.energy.tomorrow', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});

			if (this.config.everyhourEnabled) {
				await this.createHoursStates('summary.power.hoursToday');
				await this.createHoursStates('summary.power.hoursTomorrow');
			} else {
				await this.delObjectAsync('summary.power.hoursToday', { recursive: true });
				await this.delObjectAsync('summary.power.hoursTomorrow', { recursive: true });
			}

		} catch (err) {
			this.log.error(`Error on init: ${err}`);
		}

		this.log.debug('init done');
	}

	async createHoursStates(prefix) {
		await this.setObjectNotExistsAsync(prefix, {
			type: 'channel',
			common: {
				name: {
					en: 'By hour',
					de: 'Stundenweise',
					ru: 'По часам',
					pt: 'Por hora',
					nl: 'Per uur',
					fr: 'Par heure',
					it: 'Di ora',
					es: 'por hora',
					pl: 'O godzinę',
					'zh-cn': '按小时'
				}
			},
			native: {}
		});

		const validHourKeys = this.getValidHourKeys();

		// Create all states for valid hours
		await asyncForEach(validHourKeys, async (hourKey) => {
			await this.setObjectNotExistsAsync(`${prefix}.${hourKey}`, {
				type: 'state',
				common: {
					name: {
						en: 'Estimated power',
						de: 'Geschätzte Leistung',
						ru: 'Расчетная мощность',
						pt: 'Potência estimada',
						nl: 'Geschat vermogen',
						fr: 'Puissance estimée',
						it: 'Potenza stimata',
						es: 'Potencia estimada',
						pl: 'Szacowana moc',
						'zh-cn': '估计功率'
					},
					type: 'number',
					role: 'value',
					unit: 'kW',
					read: true,
					write: false,
					def: 0
				},
				native: {}
			});

			await this.extendObjectAsync(`${prefix}.${hourKey}`, {
				common: {
					unit: this.config.watt_kw ? 'W' : 'kW'
				},
				native: {
					hourKey: hourKey
				}
			});
		});

		// Delete invalid states for current configuration
		const allHourStates = await this.getObjectViewAsync('system', 'state', {
			startkey: `${this.namespace}.${prefix}.`,
			endkey: `${this.namespace}.${prefix}.\u9999`
		});

		await asyncForEach(allHourStates.rows, async (obj) => {
			if (validHourKeys.indexOf(obj.value.native.hourKey) === -1) {
				await this.delForeignObjectAsync(obj.id);
			}
		});
	}

	getValidHourKeys() {
		const hourList = [];

		let hourInterval = 60;

		if (this.config.everyhourStepsize === 'half') {
			hourInterval = 30;
		} else if (this.config.everyhourStepsize === 'quarter') {
			hourInterval = 15;
		}

		// Solcast doesn't provide 15min forecasts
		if (this.config.service === 'solcast' && hourInterval < 30) {
			hourInterval = 30;
			this.log.info(`Hour interval is set to ${hourInterval} - smaller values not supported by Solcast`);
		}

		for (let h = 5; h < 22; h++) {
			if (this.hasApiKey) {
				for (let m = 0; m <= 45; m += hourInterval) {
					hourList.push(`${h <= 9 ? '0' + h : h}:${m <= 9 ? '0' + m : m}:00`);
				}
			} else {
				hourList.push(`${h <= 9 ? '0' + h : h}:00:00`);
			}
		}

		return hourList;
	}

	cleanNamespace(id) {
		return id
			.trim()
			.replace(/\s/g, '_') // Replace whitespaces with underscores
			.replace(/[^\p{Ll}\p{Lu}\p{Nd}]+/gu, '_') // Replace not allowed chars with underscore
			.replace(/[_]+$/g, '') // Remove underscores end
			.replace(/^[_]+/g, '') // Remove underscores beginning
			.replace(/_+/g, '_') // Replace multiple underscores with one
			.toLowerCase()
			.replace(/_([a-z])/g, (m, w) => {
				return w.toUpperCase();
			});
	}

	convertAzimuth(angle) {
		// from south to north
		let newAngle = (angle + 180) * -1;
		if (newAngle < -180) {
			newAngle = 180 + 180 + newAngle;
		}
		return newAngle;
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.updateServiceDataTimeout) {
				this.clearTimeout(this.updateServiceDataTimeout);
			}
			callback();
		} catch (e) {
			callback();
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Pvforecast(options);
} else {
	// otherwise start the instance directly
	new Pvforecast();
}