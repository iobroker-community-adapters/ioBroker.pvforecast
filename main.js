'use strict';

/*
 * Created with @iobroker/create-adapter v2.1.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const { threadId } = require('worker_threads');
const moment = require('moment');
const axios = require('axios');
//const { testAdapterWithMocks } = require('@iobroker/testing/build/tests/unit');

const tooltip_AppendText= ' Watt';
let apikey = false;
let globaleveryhour = {};
let globalweatherdata = {};
const updateIntervall = 60 * 1000 * 10; // 10 Minuten
let getdatatimeout, updatetimeout;

class Pvforecast extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'pvforecast',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		this.log.debug('Config: ' + JSON.stringify(this.config));

		if(this.config.longitude == '' || typeof(this.config.longitude) == 'undefined' || this.config.latitude == '' || typeof(this.config.latitude) == 'undefined') {
			this.log.error('Please set the longitude and latitude in the adapter configuration!');
			return;
		}
		if(typeof(this.config.devices) == 'undefined' || this.config.devices.length == 0) {
			this.log.error('Please set at least one device in the adapter configuration!');
			return;
		}
		if(typeof(this.config.intervall) == 'undefined' || this.config.intervall == '' || this.config.intervall < 60) {
			this.config.tschedule = 60;
		}

		if(typeof(this.config.apikey) != 'undefined' && this.config.apikey != '') {
			apikey = true;
		}

		await this.create_delete_state();

		await this.getPv();
		if(apikey && this.config.weather_active) await this.getweather();
		this.updateActualDataIntervall ();

		// get all data next time x minutes
		getdatatimeout = setTimeout(async () => {
			this.getAllDataIntervall();
		}, this.config.tschedule * 1000 * 60);
	}
	async getAllDataIntervall(){
		this.clearTimeout(getdatatimeout);
		await this.getPv();
		if(apikey && this.config.weather_active) await this.getweather();
		getdatatimeout = setTimeout(async () => {
			this.getAllDataIntervall();
		}, this.config.tschedule * 1000 * 60);
	}

	async updateActualDataIntervall () {
		this.clearTimeout(updatetimeout);
		const plantArray = this.config.devices;
		let summerywatt=0;
		let summerywatth=0;

		await asyncForEach(plantArray, async (plant) => {
			const stateValue = await this.getStateAsync(plant.name + '.object');
			const valuearray = JSON.parse(stateValue.val);

			if(typeof(valuearray) == 'undefined') return; // cancel if no data

			await this.setStateAsync(plant.name + '.lastUpdated_data', {val:  moment().format('YYYY-MM-DD HH:mm'), ack: true});

			for(const time in valuearray.watts) {
				if(moment().valueOf() - (updateIntervall/2) < moment(time).valueOf() && moment().valueOf() + (updateIntervall/2) > moment(time).valueOf() ) {
					summerywatt += valuearray.watts[time];
					summerywatth += valuearray.watt_hours[time];
					await this.setStateAsync(plant.name + '.power_kW', {val: Number(valuearray.watts[time]), ack: true});
					await this.setStateAsync(plant.name + '.power_kWh', {val: Number(valuearray.watt_hours[time]), ack: true});
				}
			}
			this.log.debug('finished plant update ' + plant.name);
		});
		this.log.debug('finished plants update');
		await this.setStateAsync('summary.lastUpdated_data', {val: moment().format('YYYY-MM-DD HH:mm'), ack: true});
		await this.setStateAsync('summary.power_kW', {val: Number(summerywatt/1000), ack: true});
		await this.setStateAsync('summary.power_kWh', {val: Number(summerywatth/1000), ack: true});

		if(apikey && this.config.weather_active) await this.updateWeatherData();

		updatetimeout = setTimeout(async () => {
			this.updateActualDataIntervall();
		}, updateIntervall);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.clearTimeout(getdatatimeout);
			this.clearTimeout(updatetimeout);
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
	async updateWeatherData () {
		try {
			for(let i=0; i< globalweatherdata.length; i++) {
				//if value between /2 Intervall
				if(moment().valueOf() - (updateIntervall/2) < globalweatherdata[i] && moment().valueOf() + (updateIntervall/2) > globalweatherdata[i] ) {
					this.log.debug('sky' + globalweatherdata[i].sky);
					this.log.debug('datetime' + globalweatherdata[i].datetime);
					this.log.debug('visibility' + globalweatherdata[i].visibility);
					this.log.debug('temperature' + globalweatherdata[i].temperature);
					this.log.debug('condition' + globalweatherdata[i].condition);
					this.log.debug('icon' + globalweatherdata[i].icon);
					this.log.debug('wind_speed' + globalweatherdata[i].wind_speed);
					this.log.debug('wind_degrees' + globalweatherdata[i].wind_degrees);
					this.log.debug('wind_direction' + globalweatherdata[i].wind_direction);

					await this.setStateAsync('weather.sky',{val:Number(globalweatherdata[i].sky), ack:true});
					await this.setStateAsync('weather.datetime',{val:globalweatherdata[i].datetime, ack:true});
					await this.setStateAsync('weather.visibility',{val:Number(globalweatherdata[i].visibility), ack:true});
					await this.setStateAsync('weather.temperature',{val:Number(globalweatherdata[i].temperature), ack:true});
					await this.setStateAsync('weather.condition',{val:globalweatherdata[i].condition, ack:true});
					await this.setStateAsync('weather.icon',{val:globalweatherdata[i].icon, ack:true});
					await this.setStateAsync('weather.wind_speed',{val:Number(globalweatherdata[i].wind_speed), ack:true});
					await this.setStateAsync('weather.wind_degrees',{val:Number(globalweatherdata[i].wind_degrees), ack:true});
					await this.setStateAsync('weather.wind_direction',{val:globalweatherdata[i].wind_direction, ack:true});
				}
			}
			//}
			// eslint-disable-next-line no-empty
		}catch (e) {
		}
	}

	async getweather () {
		try {
			const weather_active = this.config.weather_active;
			const apikey_weater = this.config.APIK;

			const url_weather1 = this.config.linkdata + '/' + apikey_weater + '/weather/' + this.config.latitude + '/' + this.config.longitude; + '/';
			this.log.debug('url_weather1' + url_weather1);

			if (apikey) {
				if (weather_active) {

					await axios.get(url_weather1)
						.then(async(response) => {
							this.log.debug('axios weather done');
							globalweatherdata = response.data.result;
							await this.setStateAsync('weather.object',{val:JSON.stringify(response.data.result), ack:true});
							return;
						})
						.catch((error) =>{
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

	async getPv(){
		this.log.info('getPv');
		this.log.info('apikey: ' + apikey);
		const akey = apikey == true ? '/'+ this.config.apikey : '';
		const plantArray = this.config.devices;
		let succes = false;
		let todaytotalwatt = 0;
		let tomorrowtotalwatt = 0;
		const requesArray = [];
		const alltable = [];

		const allgraph = [];
		const allgraphlabel = [];

		globaleveryhour = {};

		plantArray.forEach( async (plant) => {
			const url = this.config.linkdata + akey + '/estimate/'+this.config.latitude +'/'+this.config.longitude +'/'+plant.tilt+'/'+ plant.azimuth+'/'+ plant.peakpower;
			this.log.info('url for platn '+ plant.name+  ' : '+ url);
			requesArray.push (axios.get(url));
		});

		await axios.all(requesArray)
			.then(axios.spread(async (...responses) => {
				//this.log.debug(JSON.stringify(responses));
				await asyncForEach(responses, async (plantdata, index) => {
					this.log.info('Recive data for '+ plantArray[index].name+': ' + JSON.stringify(plantdata.data));
					const data = plantdata.data.result;
					const message = plantdata.data.message;

					await this.setStateAsync(plantArray[index].name + '.object',{val:JSON.stringify(data), ack:true});
					await this.setStateAsync(plantArray[index].name + '.power_day_kWh',{val:Number(data.watt_hours_day[moment().format('YYYY-MM-DD')]/1000), ack:true});
					await this.setStateAsync(plantArray[index].name + '.power_day_tomorrow_kWh',{val:Number(data.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')]/1000), ack:true});
					await this.setStateAsync(plantArray[index].name + '.plantname',{val:plantArray[index].name, ack:true});
					await this.setStateAsync(plantArray[index].name + '.lastUpdated_object',{val:moment().format('YYYY-MM-DD HH:mm'), ack:true});
					await this.setStateAsync(plantArray[index].name + '.transfer', {val: message.type, ack: true});
					await this.setStateAsync(plantArray[index].name + '.place', {val: message.info.place, ack: true});

					//count total watt
					todaytotalwatt = todaytotalwatt + Number(data.watt_hours_day[moment().format('YYYY-MM-DD')]/1000);
					tomorrowtotalwatt = tomorrowtotalwatt + Number(data.watt_hours_day[moment().add(1, 'days').format('YYYY-MM-DD')]/1000);

					//jsongraph
					const table = [], graphTimeData = [];
					let wattindex = 0;
					for(const time in data.watts) {
						table.push({Uhrzeit: time, Leistung: data.watts[time]});
						graphTimeData.push({t: time, y: data.watts[time]});

						this.config.everyhour_active && this.saveEveryHour(plantArray[index].name, time, data.watts[time]);

						// add to InfluxDB
						if(this.config.actived_influxdb) {
							await this.addToInfluxDB(plantArray[index].name + '.watts',moment(time).valueOf(),data.watts[time]);
						}

						//data for alltable
						if(index === 0) {
							allgraphlabel.push(time); // for JSONgraph
							alltable[wattindex]= {'Uhrzeit': time};
							alltable[wattindex]['Gesamt'] = data.watts[time];
						}
						else{
							alltable[wattindex]['Gesamt'] = alltable[wattindex]['Gesamt'] + data.watts[time];
						}
						alltable[wattindex][plantArray[index].name] = data.watts[time];
						wattindex++;
					}
					await this.setStateAsync(plantArray[index].name + '.JSONTable',{val:JSON.stringify(table), ack:true});
					const graphData = [{'data': graphTimeData,'tooltip_AppendText':  tooltip_AppendText,'legendText': plantArray[index].name,'yAxis_id':  index   ,'type': 'bar','displayOrder': index,'barIsStacked': true,'color': plantArray[index].graphcolor,'barStackId':1,'datalabel_rotation':this.config.datalabel_rotation1,'datalabel_color':plantArray[index].labelcolor,'datalabel_fontSize':10}]
					allgraph.push(graphData);
					const graph = {'graphs': graphData};
					await this.setStateAsync(plantArray[index].name + '.JSONGraph',{val:JSON.stringify(graph), ack:true});
					succes = true;
					this.log.debug('succes: ' + succes);

					this.config.everyhour_active && this.fillEveryHourRestEmpty(plantArray[index].name);


				});

				this.log.debug('recived all data');

				await this.setStateAsync('summary.power_day_kWh',{val:Number(todaytotalwatt), ack:true});
				await this.setStateAsync('summary.power_day_tomorrow_kWh',{val: Number(tomorrowtotalwatt), ack:true});
				await this.setStateAsync('summary.JSONGraph',{val:JSON.stringify({'graphs': allgraph, 'axisLabels': allgraphlabel}), ack:true});
				await this.setStateAsync('summary.JSONTable',{val:JSON.stringify(alltable), ack:true});

				this.log.debug('global time: ' + JSON.stringify(globaleveryhour));

				return;
			}))
			.catch(error => {
				if (error == 'Error: Request failed with status code 429'){
					this.log.error('too many data requests');
				} else if (error == 'Error: Request failed with status code 400'){
					this.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
				} else if (error == 'Error: Request failed with status code 404'){
					this.log.error('Error: Not Found');
				} else if (error == 'Error: Request failed with status code 502'){
					this.log.error('Error: Bad Gateway');
				} else {
					this.log.error('Axios Error '+ error);
				}
				succes = false;
			});
	}
	async saveEveryHour(name, time, value) {
		const found = apikey ? time.match(/:00:00|:15:00|:30:00|:45:00/): time.match(/:00:00/);
		if(found && (moment().format('dd') == moment(time).format('dd'))) {
			const timeval = moment(time).format('HH:mm:ss');
			this.log.debug('saveEveryHour: ' + timeval + 'value: ' + value);
			await this.setStateAsync(name + '.everyhour_kw.' + timeval,{val: Number(value/1000), ack:true});

			if(!globaleveryhour[name]) globaleveryhour[name] =[];
			globaleveryhour[name].push({'time': timeval, 'value': Number(value)});
		}

	}
	async fillEveryHourRestEmpty(name) {


		for (let j = 5; j < 22; j++) {
			if (apikey) {
				//adapter.log.debug("mit key");
				for (let i = 0; i < 59; i = i + 15) {
					const timetext = (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00';
					const found = globaleveryhour[name].find(element => element.time === timetext);

					if (!found) {
						await this.setState(name + '.everyhour_kw.' + timetext, {
							val: Number(0),
							ack: true
						});

					}
				}
			}
			else {
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
	async addToInfluxDB(datapoint,timestamp,value) {
		try {
			const influxinstance = this.config.influxinstace;
			this.sendTo('influxdb.'+ influxinstance,'storeState', {
				id: datapoint,
				state: {
					ts: timestamp,
					val: value,
					ack: true,
					from: 'pvforecast',
					//q: 0
				}
			});
		} catch (e) {
			this.log.error('Datenbank: ' + e);
		}
	
	}

	async create_delete_state (){
		try {
			const plantArray = this.config.devices;

			const weather_active = this.config.weather_active && apikey;

			this.log.debug('weather_active: ' + weather_active);
			if (weather_active) {
				this.log.info('Create States for weather');
				await this.setObjectNotExistsAsync('weather.object', {
					type: 'state',
					common: {
						name: 'object',
						type: 'json',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await this.setObjectNotExistsAsync('weather.datetime', {
					type: 'state',
					common: {
						name: 'date.time',
						type: 'string',
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
						name: 'sky',
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
						name: 'visibility',
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
						name: 'temperature',
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
						name: 'condition',
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
						name: 'icon',
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await this.setObjectNotExistsAsync('weather.wind_speed', {
					type: 'state',
					common: {
						name: 'wind_speed',
						type: 'number',
						role: 'value',
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
						name: 'wind_degrees',
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
						name: 'wind_direction',
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
			} else  if (!weather_active) {
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

			plantArray.forEach(async element => {
				this.log.info('Create States for: ' + element.name);

				await  this.setObjectNotExists(element.name + '.power_day_kWh', {
					type: 'state',
					common: {
						name: 'power_day_kWh',
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.power_day_tomorrow_kWh',{
					type: 'state',
					common: {
						name: 'power_day_tomorrow_kWh',
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.plantname',{
					type: 'state',
					common: {
						name: 'plantname',
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.lastUpdated_object',{
					type: 'state',
					common: {
						name: 'lastUpdated',
						type: 'string',
						role: 'value.time',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.place',{
					type: 'state',
					common: {
						name: 'place',
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.object',{
					type: 'state',
					common: {
						name: 'object',
						type: 'json',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.power_kW',{
					type: 'state',
					common: {
						name: 'power_kW',
						type: 'number',
						role: 'value',
						unit: 'kW',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.lastUpdated_data',{
					type: 'state',
					common: {
						name: 'lastUpdated_data',
						type: 'string',
						role: 'value.time',
						read: true,
						write: false,
						def: '00:00:00'
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.power_kWh',{
					type: 'state',
					common: {
						name: 'power_kWh',
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false,
						def: 0
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.transfer',{
					type: 'state',
					common: {
						name: 'transfer',
						type: 'string',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.JSONGraph',{
					type: 'state',
					common: {
						name: 'JSONGraph',
						type: 'json',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});
				await  this.setObjectNotExists(element.name + '.JSONTable',{
					type: 'state',
					common: {
						name: 'JSONTable',
						type: 'json',
						role: 'value',
						read: true,
						write: false,
						def: ''
					},
					native: {}
				});

				if (typeof(this.config.everyhour_active) !== 'undefined' && this.config.everyhour_active === true) {
					for (let j = 5; j < 22; j++) {
						if (apikey) {
							//adapter.log.debug('mit key');
							for (let i = 0; i < 59; i = i + 15) {
								await this.setObjectNotExists(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
									type: 'state',
									common: {
										name: 'power_kW',
										type: 'number',
										role: 'value',
										unit: 'kW',
										read: true,
										write: false,
										def: 0
									},
									native: {}
								});
							}
						} else {
							//adapter.log.debug('ohne key');
							for (let i = 15; i < 50; i = i + 15) {
								//adapter.log.debug('apiky zeit: ' + i);
								await this.delObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':'+ (i <= 9 ? '0' + i : i) + ':00');
							}
							await this.setObjectNotExists(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
								type: 'state',
								common: {
									name: 'power_kW',
									type: 'number',
									role: 'value',
									unit: 'kW',
									read: true,
									write: false,
									def: 0
								},
								native: {}
							});
						}
					}
				}
				if (typeof(this.config.everyhour_active) !== 'undefined' && this.config.everyhour_active === false){
					for (let j = 5; j < 22; j++) {
						for (let i = 0; i < 59; i = i + 15) {
							await this.delObjectAsync(element.name + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
						}
					}
				}

			});
			//	adapter.log.debug("summary");

			await this.setObjectNotExists('summary.prognose', {
				type: 'state',
				common: {
					name: 'prognose',
					type: 'json',
					role: 'value',
					read: true,
					write: false
					//def: ''
				},
				native: {}
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

function getNextDaysArray (date){
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