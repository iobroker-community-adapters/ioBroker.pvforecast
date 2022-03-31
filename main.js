'use strict';

const utils = require('@iobroker/adapter-core');
const moment = require('moment');
const axios = require('axios');

let globaleveryhour = {};
let globalweatherdata = {};
const updateInterval = 60 * 10 * 1000; // 10 minutes
let reqInterval = 60;
let globalunit = 1000;

class Pvforecast extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'pvforecast',
		});

		this.hasApiKey = false;
		this.api = 'forecastsolar';

		this.longitude = undefined;
		this.latitude = undefined;

		this.getDataTimeout = null;
		this.updateTimeout = null;

		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.log.debug(`instance config: ${JSON.stringify(this.config)}`);

		this.longitude = this.config.longitude;
		this.latitude = this.config.latitude;

		if (
			(!this.longitude && this.longitude !== 0) || isNaN(this.longitude) ||
			(!this.latitude && this.latitude !== 0) || isNaN(this.latitude)
		) {
			this.log.info('longitude and/or latitude not set, get data from system configuration');

			try {
				const systemConfigState = await this.getForeignObjectAsync('system.config');
				this.longitude = systemConfigState.common.longitude;
				this.latitude = systemConfigState.common.latitude;

				if (this.longitude && this.latitude) {
					this.log.info(`using system latitude: ${this.latitude} longitude: ${this.longitude}`);
				}
			} catch (err) {
				this.log.error(err);
			}
		}

		if (
			this.longitude == '' || typeof this.longitude == 'undefined' || isNaN(this.longitude) ||
			this.latitude == '' || typeof this.latitude == 'undefined' || isNaN(this.latitude)
		) {
			this.log.error('Please set the longitude and latitude in the adapter (or system) configuration!');
			return;
		}

		if (typeof this.config.devices == 'undefined' || this.config.devices.length == 0) {
			this.log.error('Please set at least one device in the adapter configuration!');
			return;
		}

		if (typeof this.config.intervall == 'undefined' || this.config.intervall == '' || this.config.intervall < 60) {
			reqInterval = 60 * 60 * 1000;
			this.log.warn('The interval is set to 60 minutes. Please set a value higher than 60 minutes in the adapter configuration!');
		} else {
			this.log.debug(`The interval is set to ${this.config.intervall} minutes.`);
			reqInterval = this.config.intervall * 60 * 1000;
		}

		// Check if API key is configured
		if (typeof this.config.apikey !== 'undefined' && this.config.apikey !== '') {
			this.hasApiKey = true;
		}

		// disabled Solcast till next major release...
		if (typeof this.config.linkdata !== 'undefined' && this.config.linkdata == 'https://api.solcast.com.au') {
			this.api = 'solcast';

			if (!this.hasApiKey) {
				this.log.error('Please set the API key for Solcast in the adapter configuration!');
				return;
			}
		}

		if (typeof this.config.watt_kw !== 'undefined' && this.config.watt_kw == true) {
			globalunit = 1;
		}

		await this.createAndDeleteStates();
		await this.getAllDataInterval();
		await this.updateActualDataInterval();
	}

	async parseSolcastToForecast(datajson) {
		let totalKwh = 0;
		let totalKwhTomorrow = 0;

		const convertJson = {
			watt_hours: {},
			watts: {},
			watt_hours_day: {}
		};

		await asyncForEach(datajson.forecasts, async (plantdata, index) => {
			const time = plantdata.period_end.replace(/T/g, ' ').replace(/Z/g, '');
			const newtime = moment(time).format('YYYY-MM-DD HH:mm:ss');

			if (Number(moment(time).format('HH')) < 22 && Number(moment(time).format('HH')) > 5) {
				convertJson.watts[newtime] = plantdata.pv_estimate * 1000;
				this.log.debug('plantdata.pv_estimate: ' + plantdata.pv_estimate + '  saved: ' + convertJson.watts[newtime] + 'name : ' + newtime);
			}

			if (plantdata.pv_estimate !== 0 && index !== 0) {
				if (plantdata.pv_estimate > datajson.forecasts[index - 1].pv_estimate) {
					convertJson.watt_hours[newtime] = (datajson.forecasts[index - 1].pv_estimate + ((plantdata.pv_estimate - datajson.forecasts[index - 1].pv_estimate) / 2)) / 2 * 1000;
				}
				if (plantdata.pv_estimate < datajson.forecasts[index - 1].pv_estimate) {
					convertJson.watt_hours[newtime] = (plantdata.pv_estimate + ((datajson.forecasts[index - 1].pv_estimate - plantdata.pv_estimate) / 2)) / 2 * 1000;
				}
			}
			else {
				convertJson.watt_hours[newtime] = 0;
			}

			if ((moment().format('dd') == moment(time).format('dd'))) {
				totalKwh += convertJson.watt_hours[newtime];
			} else if ((moment().add(1, 'days').format('dd') == moment(time).format('dd'))) {
				totalKwhTomorrow += convertJson.watt_hours[newtime];
			}
		});

		convertJson.watt_hours_day[moment().format('YYYY-MM-DD')] = totalKwh;
		convertJson.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')] = totalKwhTomorrow;

		this.log.debug('convertjson: ' + JSON.stringify(convertJson));

		return convertJson;
	}

	async getAllDataInterval() {
		if (this.getDataTimeout) {
			this.clearTimeout(this.getDataTimeout);
		}

		await this.getPv();

		if (this.hasApiKey && this.config.weather_active) {
			await this.getWeather();
		}

		if (this.api === 'solcast') {
			reqInterval = moment().startOf('day').add(1, 'days').add(1, 'hours').valueOf() - moment().valueOf();
		}

		this.getDataTimeout = this.setTimeout(async () => {
			this.getDataTimeout = null;
			this.getAllDataInterval();
		}, reqInterval);
	}

	async updateActualDataInterval() {
		this.log.debug('starting data update by interval');

		if (this.updateTimeout) {
			this.clearTimeout(this.updateTimeout);
		}

		const plantArray = this.config.devices;
		let summaryWatt = 0;
		let summaryWattHours = 0;

		await asyncForEach(plantArray, async (plant) => {
			const stateValue = await this.getStateAsync(plant.name + '.object');
			const valueArray = JSON.parse(stateValue.val);

			if (typeof valueArray === 'undefined') return; // cancel if no data

			await this.setStateAsync(plant.name + '.lastUpdated_data', { val: moment().valueOf(), ack: true });

			for (const time in valueArray.watts) {
				if (moment().valueOf() - (updateInterval / 2) < moment(time).valueOf() && moment().valueOf() + (updateInterval / 2) > moment(time).valueOf()) {
					summaryWatt += valueArray.watts[time];
					summaryWattHours += valueArray.watt_hours[time];

					await this.setStateAsync(plant.name + '.power_kW', { val: Number(valueArray.watts[time] / globalunit), ack: true });
					await this.setStateAsync(plant.name + '.power_kWh', { val: Number(valueArray.watt_hours[time] / globalunit), ack: true });
				}
			}

			this.log.debug(`finished plant update: "${plant.name}"`);
		});

		this.log.debug('finished plants update');

		await this.setStateAsync('summary.lastUpdated_data', { val: moment().valueOf(), ack: true });
		await this.setStateAsync('summary.power_kW', { val: Number(summaryWatt / globalunit), ack: true });
		await this.setStateAsync('summary.power_kWh', { val: Number(summaryWattHours / globalunit), ack: true });

		if (this.hasApiKey && this.config.weather_active) {
			await this.updateWeatherData();
			this.log.debug('finished weather update');
		}

		this.updateTimeout = this.setTimeout(async () => {
			this.updateTimeout = null;
			this.updateActualDataInterval();
		}, updateInterval);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.getDataTimeout) {
				this.clearTimeout(this.getDataTimeout);
			}

			if (this.updateTimeout) {
				this.clearTimeout(this.updateTimeout);
			}

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// analysis weather data
	async updateWeatherData() {
		try {
			for (let i = 0; i < globalweatherdata.length; i++) {
				// if value between /2 interval
				if (moment().valueOf() - (updateInterval / 2) < globalweatherdata[i] && moment().valueOf() + (updateInterval / 2) > globalweatherdata[i]) {
					this.log.debug('sky' + globalweatherdata[i].sky);
					this.log.debug('datetime' + globalweatherdata[i].datetime);
					this.log.debug('visibility' + globalweatherdata[i].visibility);
					this.log.debug('temperature' + globalweatherdata[i].temperature);
					this.log.debug('condition' + globalweatherdata[i].condition);
					this.log.debug('icon' + globalweatherdata[i].icon);
					this.log.debug('wind_speed' + globalweatherdata[i].wind_speed);
					this.log.debug('wind_degrees' + globalweatherdata[i].wind_degrees);
					this.log.debug('wind_direction' + globalweatherdata[i].wind_direction);

					await this.setStateAsync('weather.sky', { val: Number(globalweatherdata[i].sky), ack: true });
					await this.setStateAsync('weather.datetime', { val: globalweatherdata[i].datetime, ack: true });
					await this.setStateAsync('weather.visibility', { val: Number(globalweatherdata[i].visibility), ack: true });
					await this.setStateAsync('weather.temperature', { val: Number(globalweatherdata[i].temperature), ack: true });
					await this.setStateAsync('weather.condition', { val: globalweatherdata[i].condition, ack: true });
					await this.setStateAsync('weather.icon', { val: globalweatherdata[i].icon, ack: true });
					await this.setStateAsync('weather.wind_speed', { val: Number(globalweatherdata[i].wind_speed), ack: true });
					await this.setStateAsync('weather.wind_degrees', { val: Number(globalweatherdata[i].wind_degrees), ack: true });
					await this.setStateAsync('weather.wind_direction', { val: globalweatherdata[i].wind_direction, ack: true });
				}
			}
		} catch (e) {
		}
	}

	async getWeather() {
		try {
			if (this.hasApiKey) {
				if (this.config.weather_active && this.api == 'forecastsolar') {

					// https://api.forecast.solar/:key/weather/:lat/:lon (Professional account only)
					const url = `${this.config.linkdata}/${this.config.apikey}/weather/${this.latitude}/${this.longitude}`;
					this.log.debug(`url for weather (professional account only): ${url}`);

					await axios.get(url)
						.then(async (response) => {
							this.log.debug('axios weather done');
							globalweatherdata = response.data.result;
							await this.setStateAsync('weather.object', { val: JSON.stringify(response.data.result), ack: true });
							return;
						})
						.catch((error) => {
							if (error == 'Error: Request failed with status code 429') {
								this.log.error('too many data requests');
							} else if (error == 'Error: Request failed with status code 400') {
								this.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
							} else {
								this.log.error('Axios Error ' + error);
							}
						});
				}
			} else {
				this.log.error("you don't have an apikey");
			}
		} catch (e) {
			this.log.error('Error weather ' + e);
		}
	}

	async getPv() {
		const plantArray = this.config.devices;

		let succes = false;
		let todaytotalwatt = 0;
		let tomorrowtotalwatt = 0;

		const requesArray = [];
		const alltable = [];
		const allgraph = [];
		const allgraphlabel = [];

		globaleveryhour = {};

		plantArray.forEach(async (plant) => {
			let url = '';
			if (this.api == 'forecastsolar') {
				if (this.hasApiKey) {
					// https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec/:az/:kwp
					url = `${this.config.linkdata}/${this.config.apikey}/estimate/${this.latitude}/${this.longitude}/${plant.tilt}/${plant.azimuth}/${plant.peakpower}`;
				} else {
					// https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
					url = `${this.config.linkdata}/estimate/${this.latitude}/${this.longitude}/${plant.tilt}/${plant.azimuth}/${plant.peakpower}`;
				}
			} else if (this.api == 'solcast') {
				url = `${this.config.linkdata}/world_pv_power/forecasts?format=json&hours=48&loss_factor=1&latitude=${this.latitude}&longitude=${this.longitude}&tilt=${plant.tilt}&azimuth=${convertAzimuth(plant.azimuth)}&capacity=${plant.peakpower}&api_key=${this.config.apikey}`;
			}

			if (url) {
				this.log.debug(`url for plant "${plant.name}" estimate: ${url}`);
				requesArray.push(axios.get(url));
			}
		});

		await axios.all(requesArray)
			.then(axios.spread(async (...responses) => {
				//this.log.debug(JSON.stringify(responses));
				await asyncForEach(responses, async (plantdata, index) => {
					const plantName = plantArray[index].name;
					this.log.debug(`received data for plant "${plantName}": ${JSON.stringify(plantdata.data)}`);

					let data;
					let message;

					if (this.api == 'forecastsolar') {
						data = plantdata.data.result;
						message = plantdata.data.message;

						this.log.debug(`rate limit for forecastsolar API: ${message.ratelimit.limit} (${message.ratelimit.remaining} left in period)`);

					} else if (this.api == 'solcast') {
						data = await this.parseSolcastToForecast(plantdata.data);
						message = { 'info': { 'place': '-' }, 'type': 'Solcast' };
					}

					await this.setStateAsync(plantName + '.object', { val: JSON.stringify(data), ack: true });
					await this.setStateAsync(plantName + '.power_day_kWh', { val: Number(data.watt_hours_day[moment().format('YYYY-MM-DD')] / globalunit), ack: true });
					await this.setStateAsync(plantName + '.power_day_tomorrow_kWh', { val: Number(data.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')] / globalunit), ack: true });
					await this.setStateAsync(plantName + '.plantname', { val: plantName, ack: true });
					await this.setStateAsync(plantName + '.lastUpdated_object', { val: moment().valueOf(), ack: true });
					await this.setStateAsync(plantName + '.transfer', { val: message.type, ack: true });
					await this.setStateAsync(plantName + '.place', { val: message.info.place, ack: true });

					//count total watt
					todaytotalwatt = todaytotalwatt + Number(data.watt_hours_day[moment().format('YYYY-MM-DD')] / globalunit);
					tomorrowtotalwatt = tomorrowtotalwatt + Number(data.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')] / globalunit);

					//jsongraph
					const table = [], graphTimeData = [];
					let wattindex = 0;
					for (const time in data.watts) {
						table.push({ Uhrzeit: time, Leistung: data.watts[time] / globalunit });
						graphTimeData.push({ t: time, y: data.watts[time] / globalunit });

						if (this.config.everyhour_active) {
							this.saveEveryHour(plantName, time, data.watts[time] / globalunit);
						}

						// add to InfluxDB
						await this.addToInfluxDB(plantName + '.watts', moment(time).valueOf(), data.watts[time] / globalunit);

						//data for alltable
						if (index === 0) {
							allgraphlabel.push(time); // for JSONgraph
							alltable[wattindex] = { Uhrzeit: time };
							alltable[wattindex]['Gesamt'] = data.watts[time] / globalunit;
						} else {
							alltable[wattindex]['Gesamt'] = alltable[wattindex]['Gesamt'] + data.watts[time] / globalunit;
						}

						alltable[wattindex][plantName] = data.watts[time] / globalunit;
						wattindex++;
					}

					await this.setStateAsync(plantName + '.JSONTable', { val: JSON.stringify(table), ack: true });
					const graphData = {
						// graph
						data: graphTimeData,
						type: 'bar',
						legendText: plantName,
						displayOrder: index + 1,
						color: plantArray[index].graphcolor,
						tooltip_AppendText: this.config.watt_kw ? 'W' : 'kW',
						datalabel_show: true,
						datalabel_rotation: this.config.datalabel_rotation1 || 270,
						datalabel_color: plantArray[index].labelcolor,
						datalabel_fontSize: 12,

						// graph bar chart spfeicifc
						barIsStacked: true,
						barStackId: 1,

						// graph y-Axis
						yAxis_id: 0,
						yAxis_position: 'left',
						yAxis_show: true,
						yAxis_appendix: this.config.watt_kw ? 'W' : 'kW',
						yAxis_step: this.config.watt_kw ? 1000 : 1,
					};

					allgraph.push(graphData);
					const graph = { 'graphs': [graphData] };
					await this.setStateAsync(plantName + '.JSONGraph', { val: JSON.stringify(graph), ack: true });
					succes = true;
					this.log.debug('succes: ' + succes);

					if (this.config.everyhour_active) {
						this.fillEveryHourRestEmpty(plantName);
					}
				});

				this.log.debug('recived all data');

				if (this.config.everyhour_active) {
					await this.fillEverySummery();
				}

				await this.setStateAsync('summary.power_day_kWh', { val: Number(todaytotalwatt), ack: true });
				await this.setStateAsync('summary.power_day_tomorrow_kWh', { val: Number(tomorrowtotalwatt), ack: true });
				await this.setStateAsync('summary.JSONGraph', { val: JSON.stringify({ 'graphs': allgraph, 'axisLabels': allgraphlabel }), ack: true });
				await this.setStateAsync('summary.JSONTable', { val: JSON.stringify(alltable), ack: true });

				this.log.debug('global time: ' + JSON.stringify(globaleveryhour));

				return;
			}))
			.catch(error => {
				if (error == 'Error: Request failed with status code 429') {
					this.log.error('too many data requests');
				} else if (error == 'Error: Request failed with status code 400') {
					this.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
				} else if (error == 'Error: Request failed with status code 404') {
					this.log.error('Error: Not Found');
				} else if (error == 'Error: Request failed with status code 502') {
					this.log.error('Error: Bad Gateway');
				} else {
					this.log.error('Axios Error ' + error);
				}
				succes = false;
			});
	}

	async saveEveryHour(name, time, value) {
		const found = this.hasApiKey ? time.match(/:00:00|:15:00|:30:00|:45:00/) : time.match(/:00:00/);
		if (found && (moment().format('dd') == moment(time).format('dd'))) {
			const timeval = moment(time).format('HH:mm:ss');
			this.log.debug('saveEveryHour: ' + timeval + ' value: ' + value);
			await this.setStateAsync(name + '.everyhour_kw.' + timeval, { val: Number(value), ack: true });

			if (!globaleveryhour[name]) globaleveryhour[name] = [];
			globaleveryhour[name].push({ 'time': timeval, 'value': Number(value) });
		}
	}

	async fillEverySummery() {
		const plantArray = this.config.devices;

		for (let j = 5; j < 22; j++) {
			if (this.hasApiKey) {
				const hourInterval = this.api === 'solcast' ? 30 : 15;
				for (let i = 0; i < 59; i = i + hourInterval) {
					const timetext = (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00';
					let wattsummery = 0;
					await asyncForEach(plantArray, async (plant) => {
						if (!globaleveryhour[plant.name]) return;
						const found = globaleveryhour[plant.name].find(element => element.time === timetext);
						if (found) {
							wattsummery = wattsummery + found.value;
						}

					});
					await this.setStateAsync('summary.everyhour_kw.' + timetext, {
						val: Number(wattsummery),
						ack: true
					});
				}
			} else {
				const timetext = (j <= 9 ? '0' + j : j) + ':00:00';
				let wattsummery = 0;
				await asyncForEach(plantArray, async (plant) => {
					if (!globaleveryhour[plant.name]) return;
					const found = globaleveryhour[plant.name].find(element => element.time === timetext);
					if (found) {
						wattsummery = wattsummery + found.value;
					}

				});
				await this.setStateAsync('summary.everyhour_kw.' + timetext, {
					val: Number(wattsummery),
					ack: true
				});
			}
		}
	}

	async fillEveryHourRestEmpty(name) {

		if (!globaleveryhour[name]) return;

		for (let j = 5; j < 22; j++) {
			if (this.hasApiKey) {
				const hourInterval = this.api === 'solcast' ? 30 : 15;
				for (let i = 0; i < 59; i = i + hourInterval) {
					const timetext = (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00';
					const found = globaleveryhour[name].find(element => element.time === timetext);

					if (!found) {
						await this.setState(name + '.everyhour_kw.' + timetext, {
							val: Number(0),
							ack: true
						});
					}
				}
			} else {
				const timetext = (j <= 9 ? '0' + j : j) + ':00:00';
				const found = globaleveryhour[name].find(element => element.time === timetext);

				if (!found) {
					await this.setStateAsync(name + '.everyhour_kw.' + timetext, {
						val: Number(0),
						ack: true
					});
				}
			}
		}
	}

	async addToInfluxDB(datapoint, timestamp, value) {
		try {
			let influxinstance = this.config.influxinstace;

			if (influxinstance === '') return;

			// Fallback for older instance configs
			if (influxinstance.indexOf('influxdb.') !== 0) {
				influxinstance = `influxdb.${influxinstance}`;
			}

			this.log.debug(`influxDB storeState into "${influxinstance}": value "${value}" of "${datapoint}" with timestamp ${timestamp}`);

			this.sendTo(influxinstance, 'storeState', {
				id: datapoint,
				state: {
					ts: timestamp,
					val: value,
					ack: true,
					from: 'system.adapter.' + this.namespace,
					//q: 0
				}
			});
		} catch (e) {
			this.log.error('Datenbank: ' + e);
		}
	}

	async createAndDeleteStates() {
		try {
			const plantArray = this.config.devices;

			if (this.hasApiKey && this.config.weather_active) {
				this.log.debug('creating states for weather');

				await this.setObjectNotExistsAsync('weather.object', {
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
						def: ''
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
						write: false,
						def: ''
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
				await this.delObjectAsync('weather.object');
				await this.delObjectAsync('weather.datetime');
				await this.delObjectAsync('weather.sky');
				await this.delObjectAsync('weather.visibility');
				await this.delObjectAsync('weather.temperature');
				await this.delObjectAsync('weather.condition');
				await this.delObjectAsync('weather.icon');
				await this.delObjectAsync('weather.wind_speed');
				await this.delObjectAsync('weather.wind_degrees');
				await this.delObjectAsync('weather.wind_direction');
			}

			await asyncForEach(plantArray, async (element) => {
				this.log.debug(`creating states for plant: "${element.name}"`);

				await this.setObjectNotExists(element.name + '.power_kW', {
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
				await this.setObjectNotExists(element.name + '.power_kWh', {
					type: 'state',
					common: {
						name: {
							en: 'Estimated energy (now)',
							de: 'Geschätzte Energie (jetzt)',
							ru: 'Расчетная энергия (сейчас)',
							pt: 'Energia estimada (agora)',
							nl: 'Geschatte energie (nu)',
							fr: 'Énergie estimée (maintenant)',
							it: 'Energia stimata (ora)',
							es: 'Energía estimada (ahora)',
							pl: 'Szacowana energia (teraz)',
							'zh-cn': '估计能量（现在）'
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
				await this.setObjectNotExists(element.name + '.power_day_kWh', {
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
				await this.setObjectNotExists(element.name + '.power_day_tomorrow_kWh', {
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
				await this.setObjectNotExists(element.name + '.plantname', {
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
				await this.setObjectNotExists(element.name + '.lastUpdated_object', {
					type: 'state',
					common: {
						name: {
							en: 'Last update (object)',
							de: 'Letzte Aktualisierung (Objekt)',
							ru: 'Последнее обновление (объект)',
							pt: 'Última atualização (objeto)',
							nl: 'Laatste update (object)',
							fr: 'Dernière mise à jour (objet)',
							it: 'Ultimo aggiornamento (oggetto)',
							es: 'Última actualización (objeto)',
							pl: 'Ostatnia aktualizacja (obiekt)',
							'zh-cn': '上次更新（对象）'
						},
						type: 'number',
						role: 'value.time',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await this.setObjectNotExists(element.name + '.place', {
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
				await this.setObjectNotExists(element.name + '.object', {
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
				await this.setObjectNotExists(element.name + '.lastUpdated_data', {
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
						def: '00:00:00'
					},
					native: {}
				});
				await this.setObjectNotExists(element.name + '.transfer', {
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
				await this.setObjectNotExists(element.name + '.JSONGraph', {
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
						def: ''
					},
					native: {}
				});
				await this.setObjectNotExists(element.name + '.JSONTable', {
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
						def: ''
					},
					native: {}
				});

				// passe einheiten an
				await this.extendObjectAsync(element.name + '.power_kWh', {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});
				await this.extendObjectAsync(element.name + '.power_kW', {
					common: {
						unit: this.config.watt_kw ? 'W' : 'kW'
					}
				});
				await this.extendObjectAsync(element.name + '.power_day_tomorrow_kWh', {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});
				await this.extendObjectAsync(element.name + '.power_day_kWh', {
					common: {
						unit: this.config.watt_kw ? 'Wh' : 'kWh'
					}
				});

				if (typeof this.config.everyhour_active !== 'undefined' && this.config.everyhour_active === true) {
					const obj = {
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
					};

					for (let j = 5; j < 22; j++) {
						if (this.hasApiKey) {
							const hourInterval = this.api === 'solcast' ? 30 : 15;

							for (let i = 0; i < 59; i = i + hourInterval) {
								await this.setObjectNotExists(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', obj);
								await this.setObjectNotExists('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', obj);
								await this.extendObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
									common: {
										unit: this.config.watt_kw ? 'W' : 'kW'
									}
								});
								await this.extendObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
									common: {
										unit: this.config.watt_kw ? 'W' : 'kW'
									}
								});
							}
						} else {

							for (let i = 15; i < 50; i = i + 15) {
								//adapter.log.debug('apiky zeit: ' + i);
								await this.delObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
								await this.delObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
							}

							await this.setObjectNotExists(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', obj);
							await this.setObjectNotExists('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', obj);
							await this.extendObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
								common: {
									unit: this.config.watt_kw ? 'W' : 'kW'
								}
							});
							await this.extendObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
								common: {
									unit: this.config.watt_kw ? 'W' : 'kW'
								}
							});
						}
					}
				}

				// Delete states
				if (typeof this.config.everyhour_active !== 'undefined' && this.config.everyhour_active === false) {
					for (let j = 5; j < 22; j++) {
						for (let i = 0; i < 59; i = i + 15) {
							await this.delObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
							await this.delObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
						}
					}
				}

			});

			//passe einheiten an
			await this.extendObjectAsync('summary.power_kWh', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});
			await this.extendObjectAsync('summary.power_kW', {
				common: {
					unit: this.config.watt_kw ? 'W' : 'kW'
				}
			});
			await this.extendObjectAsync('summary.power_day_tomorrow_kWh', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});
			await this.extendObjectAsync('summary.power_day_kWh', {
				common: {
					unit: this.config.watt_kw ? 'Wh' : 'kWh'
				}
			});

		} catch (err) {
			this.log.error('Error on init: ' + err);
		}

		this.log.debug('init done');
	}
}

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

function convertAzimuth(angle) {
	//from south to north
	let newangle = (angle + 180) * -1;
	if (newangle < -180) {
		newangle = 180 + 180 + newangle;
	}
	return newangle;
}

function getNextDaysArray(date) {
	const nextDays = [];
	for (let i = 0; i < 7; i++) {
		nextDays.push(new Date(date.getTime() + i * 24 * 60 * 60 * 1000));
	}
	return nextDays;
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