
/**
 *
 * pvforecast adapter
 * written by Patrick Walther
 *
 */

'use strict';

// you have to require the utils module and call adapter function
const schedule = require('node-schedule');
const utils =    require('@iobroker/adapter-core');

//const request = require('request')
const axios = require('axios');
const adapter = new utils.Adapter('pvforecast');

let thisUrl ='';

const tooltip_AppendText= ' Watt';

let pvname1 = ''; let pvname2 = ''; let pvname3 = ''; let pvname4 = ''; let pvname5 = '';
const options1 = ''; const options2 = ''; const options3 = ''; const options4 = ''; const options5 = '';
const urls = [options1,options2,options3,options4,options5];

const power_kw1 = 0; const power_kw2 = 0; const power_kw3 = 0; const power_kw4 = 0; const power_kw5 = 0;
const power_kwh1 = 0; const power_kwh2 = 0; const power_kwh3 = 0; const power_kwh4 = 0; const power_kwh5 = 0;
const power_kw = [power_kw1,power_kw2,power_kw3,power_kw4,power_kw5];
const power_kwh = [power_kwh1,power_kwh2,power_kwh3,power_kwh4,power_kwh5];

const watts_tomorrow_plants1 = 0; const watts_tomorrow_plants2 = 0; const watts_tomorrow_plants3 = 0; const watts_tomorrow_plants4 = 0; const watts_tomorrow_plants5 = 0;
const watts_tag_plants1 = 0; const watts_tag_plants2 = 0; const watts_tag_plants3 = 0; const watts_tag_plants4 = 0; const watts_tag_plants5 = 0;
const watts_tomorrow_plants = [watts_tomorrow_plants1,watts_tomorrow_plants2,watts_tomorrow_plants3,watts_tomorrow_plants4,watts_tomorrow_plants5];
const watts_tag_plants = [watts_tag_plants1,watts_tag_plants2,watts_tag_plants3,watts_tag_plants4,watts_tag_plants5];
let data_tschedule = '';

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
	try {
		adapter.log.debug('cleaned everything up...');
		schedule.cancelJob('datenauswerten');
		//clearTimeout(timeout);
		clearInterval(timer2);
		callback();
	} catch (e) {
		callback();
	}
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
	main();
});

async function main() {
	try {
		await create_delete_state();
		const data_adapter_timeout = adapter.config.timeout;
		let data_timeout;
		if(data_adapter_timeout !=''){
			data_timeout =data_adapter_timeout * 1000;
		}else{
			data_timeout = 10000;
		}

		adapter.log.debug('timeout eingabe: ' + data_timeout /1000 + ' sec');


		setTimeout(async  function() {await getPV(); }, data_timeout);
		//await getPV();

		data_tschedule = adapter.config.tschedule;

		if (data_tschedule != '') {
			data_tschedule = adapter.config.tschedule;
			adapter.log.debug('tschedule eingabe: ' + data_tschedule + ' min');
			data_tschedule = 60000 * data_tschedule;
		} else {
			data_tschedule = 3600000;
			adapter.log.debug('tschedule standart: ' + data_tschedule / 60000 + ' min');
		}
		const timer2 = setInterval(datenübertragen, data_tschedule); //360000

		const weather_active = adapter.config.weather_active;

		if(weather_active == true) {
			await getweather();
		}
	}catch (e) {

	}
}

async function datenübertragen(){
	try {
		await create_delete_state();
		await getPV();

		const weather_active = adapter.config.weather_active;
		if(weather_active == true) {
			await getweather ();
		}
	} catch (e) {

	}

}

// evaluate data from json to data point every minute
const calc2 = schedule.scheduleJob('datenauswerten', '* * * * *', async function () {
	try {
		const weather_active = adapter.config.weather_active;
		if(weather_active == true) {
			await weather_data();
		}

		const plant1_active1 = true;
		const plant2_active2 = adapter.config.plant2_active;
		const plant3_active3 = adapter.config.plant3_active;
		const plant4_active4 = adapter.config.plant4_active;
		const plant5_active5 = adapter.config.plant5_active;
		const plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

		const d = new Date();
		const dd = d.getUTCDate();
		const mm = d.getUTCMonth() + 1;
		const yy= d.getUTCFullYear();
		const h = d.getHours();
		const m = d.getMinutes();
		const uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
		const datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
		const datetime1 = datum + ' ' + uhrzeit;

		try {
			for (let index = 1; index < 6; index++) {
				const stateValue = await adapter.getStateAsync(index + '.object');
				if (plant_active[index - 1]) {
					const obj = JSON.parse(stateValue.val).result;

					let watt1 = obj.watts[datum + ' ' + uhrzeit + ':00'];
					let watth = obj.watt_hours[datum + ' ' + uhrzeit + ':00'];

					await adapter.setStateAsync(index + '.lastUpdated_data', {val: datetime1, ack: true});

					if (watt1 >= 0) {

						// conversion from Wh and kWh
						watt1 = watt1 / 1000;
						watth = watth / 1000;

						power_kw[index - 1] = watt1;
						power_kwh[index - 1] = watth;

						adapter.log.debug(index + '.power_kW: ' + watt1);
						adapter.log.debug(index + '.power_kWh: ' + watth);

						await adapter.setStateAsync(index + '.power_kW', {val: Number(watt1), ack: true});
						await adapter.setStateAsync(index + '.power_kWh', {val: Number(watth), ack: true});
					}
				}
			}

			let power_kwh_summary = 0;
			let power_kw_summary = 0;

			for (let i = 0; i < 5; i++) {
				if (power_kw[i] !== 0) {
					power_kw_summary = power_kw_summary + power_kw[i];
				}
			}

			for (let i = 0; i < 5; i++) { //power_kwh.length
				if (power_kwh[i] !== 0) {
					power_kwh_summary = power_kwh_summary + power_kwh[i];
				}
			}

			adapter.log.debug('summary.power_kw: ' + JSON.stringify(power_kw));
			adapter.log.debug('summary.power_kwh : ' + JSON.stringify(power_kwh));

			await adapter.setStateAsync('summary.lastUpdated_data', {val: datetime1, ack: true});
			await adapter.setStateAsync('summary.power_kW', {val: Number(power_kw_summary), ack: true});
			await adapter.setStateAsync('summary.power_kWh', {val: Number(power_kwh_summary), ack: true});
		}	catch (err) {

		}
	} catch (e) {

	}

});

// request pv-data from server
async function getPV () {

	adapter.log.debug('getpv');
	//Variablen zur Übergabe und Prüfen der Einträge im Admin
	//main
	const forcastUrl = adapter.config.linkdata; //var account = adapter.config.account;
	/*var settinggpsiobroker = adapter.config.settingsiobroker; */
	let apikey = adapter.config.APIK; const lon = adapter.config.longitude; const lat  = adapter.config.latitude;

	//plant1
	const Neigung1 = adapter.config.tilt1;
	const Azimuth1 = adapter.config.Azimuth1;
	const Anlagenleistung1 = adapter.config.Plantp1;pvname1 = adapter.config.pvname1;

	//plant2
	const Neigung2 = adapter.config.tilt2;
	const Azimuth2 = adapter.config.Azimuth2;
	const Anlagenleistung2 = adapter.config.Plantp2;	pvname2 = adapter.config.pvname2;

	//plant3
	const Neigung3 = adapter.config.tilt3;
	const Azimuth3 = adapter.config.Azimuth3;
	const Anlagenleistung3 = adapter.config.Plantp3;	pvname3 = adapter.config.pvname3;

	//plant4
	const Neigung4 = adapter.config.tilt4;
	const Azimuth4 = adapter.config.Azimuth4;
	const Anlagenleistung4 = adapter.config.Plantp4;	pvname4 = adapter.config.pvname4;

	//plant5
	const Neigung5 = adapter.config.tilt5;
	const Azimuth5 = adapter.config.Azimuth5;
	const Anlagenleistung5 = adapter.config.Plantp5; pvname5 = adapter.config.pvname5;


	//Data from settings user interface
	const legend1 = adapter.config.legend1;
	const graphcolor1 = adapter.config.graphcolor1;
	const datalabelColor1 = adapter.config.datalabelColor1;

	const legend2 = adapter.config.legend2;
	const graphcolor2 = adapter.config.graphcolor2;
	const datalabelColor2 = adapter.config.datalabelColor2;

	const legend3 = adapter.config.legend3;
	const graphcolor3 = adapter.config.graphcolor3;
	const datalabelColor3 = adapter.config.datalabelColor3;

	const legend4 = adapter.config.legend4;
	const graphcolor4 = adapter.config.graphcolor4;
	const datalabelColor4 = adapter.config.datalabelColor4;

	const legend5 = adapter.config.legend5;
	const graphcolor5 = adapter.config.graphcolor5;
	const datalabelColor5 = adapter.config.datalabelColor5;

	const axisy_step = adapter.config.axisy_step1;
	const datalabel_rotation = adapter.config.datalabel_rotation1;
	const pvname = [pvname1,pvname2,pvname3,pvname4,pvname5];

	const plant1_active1 = true;
	const plant2_active2 = adapter.config.plant2_active;
	const plant3_active3 = adapter.config.plant3_active;
	const plant4_active4 = adapter.config.plant4_active;
	const plant5_active5 = adapter.config.plant5_active;
	const plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

	const declination = [Neigung1,Neigung2,Neigung3,Neigung4,Neigung5];
	const azimuth = [Azimuth1,Azimuth2,Azimuth3, Azimuth4, Azimuth5];
	const kwp = [Anlagenleistung1,Anlagenleistung2,Anlagenleistung3,Anlagenleistung4,Anlagenleistung5];

	let url_read_index = 1;

	//user interface data in array

	const legendTest = [legend1,legend2,legend3,legend4,legend5]; // z.b. west
	const graphColor = [graphcolor1,graphcolor2,graphcolor3,graphcolor4,graphcolor5];  // z.b. blue
	const datalabelColor = [datalabelColor1,datalabelColor2,datalabelColor3,datalabelColor4,datalabelColor5]; // z.b. lightblue

	if(apikey !== ''){ apikey = '/' + apikey;}

	urls[0]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[0]+'/'+azimuth[0]+'/'+kwp[0];
	adapter.log.debug('Längengrad: ' + lon + '	Breitengrad: ' + lat);
	adapter.log.debug('urls: ' + urls[0]);
	adapter.log.debug('Plant1 -> tilt: ' + Neigung1 + ' Azimuth: ' + Azimuth1 + ' Plant-performance: ' + Anlagenleistung1 + ' plant name: ' + pvname1);

	if (plant2_active2 == true){
		urls[1]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[1]+'/'+azimuth[1]+'/'+kwp[1];
		adapter.log.debug('urls: ' + urls[1]);
		adapter.log.debug('Plant2 -> tilt: ' + Neigung2 + ' Azimuth: ' + Azimuth2 + ' Plant-performance: ' + Anlagenleistung2 + ' plant name: ' + pvname2);
	}
	if (plant3_active3 == true){
		urls[2]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[2]+'/'+azimuth[2]+'/'+kwp[2];
		adapter.log.debug('urls: ' + urls[2]);
		adapter.log.debug('Plant3 -> tilt: ' + Neigung3 + ' Azimuth: ' + Azimuth3 + ' Plant-performance: ' + Anlagenleistung3 + ' plant name: ' + pvname3);
	}
	if (plant4_active4 == true){
		urls[3]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[3]+'/'+azimuth[3]+'/'+kwp[3];
		adapter.log.debug('urls: ' + urls[3]);
		adapter.log.debug('Plant4 -> tilt: ' + Neigung4 + ' Azimuth: ' + Azimuth4 + ' Plant-performance: ' + Anlagenleistung4 + ' plant name: ' + pvname4);
	}
	if (plant5_active5 == true){
		urls[4]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[4]+'/'+azimuth[4]+'/'+kwp[4];
		adapter.log.debug('urls: ' + urls[4]);
		adapter.log.debug('Plant5 -> tilt: ' + Neigung5 + ' Azimuth: ' + Azimuth5 + ' Plant-performance: ' + Anlagenleistung5 + ' plant name: ' + pvname5);
	}
	//date from today and tomorrow
	const d = new Date();
	const dd = d.getUTCDate();
	const mm = d.getUTCMonth() + 1;
	const yy= d.getUTCFullYear();
	const h = d.getHours();
	const m = d.getMinutes();
	const uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
	const data_today = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

	//var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd); //aktueller tag

	const datetime =data_today + ' ' + uhrzeit;


	//heute = heute.getDate();
	const vorhersage_d_tag1=0;
	const vorhersage_d_tag2=0;
	const vorhersage_d_tag3=0;
	const vorhersage_d_tag4=0;
	const vorhersage_d_tag5=0;
	const vorhersage_d_tag6=0;
	const vorhersage_d_tag7=0;
	const vorhersage_datum = [vorhersage_d_tag1,vorhersage_d_tag2,vorhersage_d_tag3,vorhersage_d_tag4,vorhersage_d_tag5,vorhersage_d_tag6,vorhersage_d_tag7];
	const heute = new Date();
	//let morgen = new Date(heute.getTime()); // übermorgen wäre dann am Ende eine 2 anstatt 1

	for (let i = 0; i < 8; i++) {
		const tag_uebergabe = new Date(heute.getTime() + (1000 * 60 * 60 * 24 * i)); // übermorgen wäre dann am Ende eine 2 anstatt 1
		vorhersage_datum[i] = tag_uebergabe.getDate();
	}

	//adapter.log.debug("'"vorhersage_datum' + vorhersage_datum);
	const date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[0] <= 9 ? '0' + vorhersage_datum[0] : vorhersage_datum[0]);
	const date_2 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[1] <= 9 ? '0' + vorhersage_datum[1] : vorhersage_datum[1]);
	/*var date_3 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[2] <= 9 ? '0' + vorhersage_datum[2] : vorhersage_datum[2]);
	var date_4 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[3] <= 9 ? '0' + vorhersage_datum[3] : vorhersage_datum[3]);
	var date_5 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[4] <= 9 ? '0' + vorhersage_datum[4] : vorhersage_datum[4]);
	var date_6 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[5] <= 9 ? '0' + vorhersage_datum[5] : vorhersage_datum[5]);
	var date_7 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[6] <= 9 ? '0' + vorhersage_datum[6] : vorhersage_datum[6]);
*/
	adapter.log.debug('plant_active: ' + plant_active);
	adapter.log.debug('pvname: ' + pvname);

	//data to datapoints |graph | table
	for (const url_read of urls) {
		thisUrl = url_read;
		adapter.log.debug('ThisUrl '+thisUrl);
		if (thisUrl) {
			adapter.log.debug('axios start');
			await axios
				.get(thisUrl)
				.then (async function(response) {
					adapter.log.debug('axios done');

					const res = response.data.result;
					const res2 = response.data.message;
					//adapter.log.debug('Json axios '+JSON.stringify(response.data.result));

					let wattstunden_tag = res.watt_hours_day[date_1];
					let wattstunden_tag_tomorrow = res.watt_hours_day[date_2];

					watts_tag_plants[url_read_index] = 0;
					watts_tomorrow_plants[url_read_index] = 0;

					// conversion  from Wh to kWh
					wattstunden_tag = wattstunden_tag / 1000;
					watts_tag_plants[url_read_index-1] = wattstunden_tag ;

					wattstunden_tag_tomorrow = wattstunden_tag_tomorrow / 1000;
					watts_tomorrow_plants[url_read_index-1] = wattstunden_tag_tomorrow ;

					// write value to datapoints
					//adapter.log.debug("url_read_index" + url_read_index);

					await adapter.setStateAsync(url_read_index + '.object',{val:JSON.stringify(response.data), ack:true});
					await adapter.setStateAsync(url_read_index + '.power_day_kWh',{val:Number(wattstunden_tag), ack:true});
					await adapter.setStateAsync(url_read_index + '.power_day_tomorrow_kWh',{val:Number(wattstunden_tag_tomorrow), ack:true});
					await adapter.setStateAsync(url_read_index + '.plantname',{val:pvname[url_read_index-1], ack:true});
					await adapter.setStateAsync(url_read_index + '.lastUpdated_object',{val:datetime, ack:true});

					const watts = res.watts;

					//jsongraph
					const table = [];

					for(const time in watts) {
						const entry = {};

						entry.Uhrzeit = time;
						entry.Leistung = watts[time];
						table.push(entry);
					}

					await adapter.setStateAsync(url_read_index + '.JSONTable',{val:JSON.stringify(table), ack:true});

					// GraphTable
					const graphTimeData = [];

					for(const time in watts) {
						const graphEntry ={};
						graphEntry.t = Date.parse(time);
						graphEntry.y = watts[time];
						graphTimeData.push(graphEntry);
					}

					const graph = {};
					const graphData = {'tooltip_AppendText':  tooltip_AppendText,'legendText': legendTest[url_read_index],'yAxis_id':  url_read_index   ,'type': 'bar','displayOrder': 2,'barIsStacked': true,'color':graphColor[url_read_index],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[url_read_index],'datalabel_fontSize':10};
					const graphAllData = [];

					graphData.data = graphTimeData;
					graphAllData.push(graphData);
					graph.graphs=graphAllData;

					await adapter.setStateAsync(url_read_index + '.JSONGraph',{val:JSON.stringify(graph), ack:true});

				})
				.catch(function(error) {
					if (error == 'Error: Request failed with status code 429'){
						adapter.log.error('too many data requests');
					} else if (error == 'Error: Request failed with status code 400'){
						adapter.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
					} else if (error == 'Error: Request failed with status code 404'){
						adapter.log.error('Error: Not Found');
					} else if (error == 'Error: Request failed with status code 502'){
						adapter.log.error('Error: Bad Gateway');
					} else {
						adapter.log.error('Axios Error '+ error);
					}
				});
		}
		url_read_index =  url_read_index + 1;
	}

	let wattstunden_tag_summary = 0;
	let wattstunden_tag_tomorrow_summary = 0;

	for (let i = 0; i < 5; i++) {
		if (watts_tag_plants[i] !== 0) {
			wattstunden_tag_summary = wattstunden_tag_summary + watts_tag_plants[i];
		}
	}

	for (let i = 0; i < 5; i++) {
		if (watts_tomorrow_plants[i] !== 0) {
			wattstunden_tag_tomorrow_summary = wattstunden_tag_tomorrow_summary + watts_tomorrow_plants[i];
		}
	}

	/*adapter.log.debug("watts_tag_plants[0]" + watts_tag_plants[0]);
	adapter.log.debug("watts_tag_plants[1]" + watts_tag_plants[1]);
	adapter.log.debug("watts_tag_plants[2]" + watts_tag_plants[2]);
	adapter.log.debug("watts_tag_plants[3]" + watts_tag_plants[3]);
	adapter.log.debug("watts_tag_plants[4]" + watts_tag_plants[4]);
	adapter.log.debug("watts_tomorrow_plants" + watts_tomorrow_plants);
*/

	adapter.log.debug('summary.power_day_kWh:' + wattstunden_tag_summary + ' summary.power_day_tomorrow_kWh: ' + wattstunden_tag_tomorrow_summary);

	await adapter.setStateAsync('summary.power_day_kWh',{val:Number(wattstunden_tag_summary), ack:true});
	await adapter.setStateAsync('summary.power_day_tomorrow_kWh',{val: Number(wattstunden_tag_tomorrow_summary), ack:true});

	const uebergabe_power_kw1 = 0;	const uebergabe_power_kw2 = 0;	const uebergabe_power_kw3 = 0;	const uebergabe_power_kw4 = 0;	const uebergabe_power_kw5 = 0;
	const uebergabe_power_kwh1 = 0;	const uebergabe_power_kwh2 = 0;	const uebergabe_power_kwh3 = 0;	const uebergabe_power_kwh4 = 0;	const uebergabe_power_kwh5 = 0;

	const uebergabe_power_kw = [uebergabe_power_kw1,uebergabe_power_kw2,uebergabe_power_kw3,uebergabe_power_kw4,uebergabe_power_kw5];
	const uebergabe_power_kwh = [uebergabe_power_kwh1,uebergabe_power_kwh2,uebergabe_power_kwh3,uebergabe_power_kwh4,uebergabe_power_kwh5];

	for (let index = 1; index < 6; index++) {
		if (plant_active[index-1] == true) {
			const stateValue = await adapter.getStateAsync(index + '.object');
			if (stateValue.val !== ''){
				const obj2 = JSON.parse(stateValue.val).result;
				uebergabe_power_kw[index] = obj2.watts;
				uebergabe_power_kwh[index] = obj2.watt_hours;
				const obj5 = JSON.parse(stateValue.val).message;
				const place1 = obj5.info.place;
				const type1 = obj5.type;
				adapter.log.debug(index + '.transfer: ' + type1);
				adapter.log.debug(index + '.place: ' + place1);
				await adapter.setStateAsync(index + '.transfer', {val: type1, ack: true});
				await adapter.setStateAsync(index + '.place', {val: place1, ack: true});
			}
		}
	}


	adapter.log.debug('vorübergabe_power_kw[0]: ' + JSON.stringify(uebergabe_power_kw[0]));
	adapter.log.debug('vorübergabe_power_kw[1]: ' + JSON.stringify(uebergabe_power_kw[1]));
	adapter.log.debug('vorübergabe_power_kw[2]: ' + JSON.stringify(uebergabe_power_kw[2]));
	adapter.log.debug('vorübergabe_power_kw[3]: ' + JSON.stringify(uebergabe_power_kw[3]));
	adapter.log.debug('vorübergabe_power_kw[4]: ' + JSON.stringify(uebergabe_power_kw[4]));

	const graph = {}; const table = []; const axisLabels = [];

	const watts1 = uebergabe_power_kw[1]; const	watts2 = uebergabe_power_kw[2]; const	watts3 = uebergabe_power_kw[3]; const	watts4 = uebergabe_power_kw[4]; const	watts5 = uebergabe_power_kw[5];



	for(const time in watts1) {

		const pos1 = time.indexOf(':00:00');
		const pos2 = time.indexOf(':15:00');
		const pos3 = time.indexOf(':30:00');
		const pos4 = time.indexOf(':45:00');

		if((pos1 !== -1) || (pos2 !== -1)|| (pos3 !== -1)|| (pos4 !== -1)) {
			const entry = {};
			entry.Uhrzeit = time;
			entry.Leistung1 = watts1[time];
			if (plant2_active2){entry.Leistung2 = watts2[time];}
			if (plant3_active3){entry.Leistung3 = watts3[time];}
			if (plant4_active4){entry.Leistung4 = watts4[time];}
			if (plant5_active5){entry.Leistung5 = watts5[time];}
			if (plant1_active1 ){entry.summe = watts1[time];}
			if (plant2_active2 ){entry.summe = watts1[time] +  watts2[time];}
			if (plant2_active2  && plant3_active3){entry.summe = watts1[time] +  watts2[time] +  watts3[time];}
			if (plant2_active2  && plant3_active3  &&  plant4_active4){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time];}
			if (plant2_active2  && plant3_active3  &&  plant4_active4 &&  plant5_active5){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time] +  watts5[time];}

			table.push(entry);
		}
	}

	// prepare data for graph

	const graphTimeData1 = []; const graphTimeData2 = []; const graphTimeData3 = []; const graphTimeData4 = []; const graphTimeData5 = [];

	for(const time in watts1) {
		const m = time;
		axisLabels.push(m);
	}

	for(const time in watts1) {
		graphTimeData1.push(watts1[time]);
	}

	for(const time in watts2) {
		graphTimeData2.push(watts2[time]);
	}

	for(const time in watts3) {
		graphTimeData3.push(watts3[time]);
	}

	for(const time in watts4) {
		graphTimeData4.push(watts4[time]);
	}

	for(const time in watts5) {
		graphTimeData5.push(watts5[time]);
	}

	const graphAllData = [];

	let graphData = {'tooltip_AppendText':  tooltip_AppendText,'legendText': legendTest[0],'yAxis_id': 1, 'yAxis_step': axisy_step,'type': 'bar','displayOrder': 2,'barIsStacked': true,'color':graphColor[0],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[0],'datalabel_fontSize':10};

	graphData.data = graphTimeData1;

	graphAllData.push(graphData);

	if (plant2_active2){

		graphData = {'tooltip_AppendText': tooltip_AppendText,'legendText': legendTest[1],'yAxis_id': 1, 'yAxis_step': axisy_step,'type': 'bar','displayOrder': 1,'barIsStacked': true,'color':graphColor[1],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[1],'datalabel_fontSize':10};

		graphData.data = graphTimeData2;

		graphAllData.push(graphData);
	}

	if (plant3_active3){

		graphData = {'tooltip_AppendText': tooltip_AppendText,'legendText': legendTest[2],'yAxis_id': 1, 'yAxis_step': axisy_step,'type': 'bar','displayOrder': 1,'barIsStacked': true,'color':graphColor[2],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[2],'datalabel_fontSize':10};

		graphData.data = graphTimeData3;

		graphAllData.push(graphData);
	}

	if (plant4_active4){

		graphData = {'tooltip_AppendText': tooltip_AppendText,'legendText': legendTest[3],'yAxis_id': 1, 'yAxis_step': axisy_step,'type': 'bar','displayOrder': 1,'barIsStacked': true,'color':graphColor[3],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[3],'datalabel_fontSize':10};

		graphData.data = graphTimeData4;

		graphAllData.push(graphData);
	}

	if (plant5_active5){
		graphData = {'tooltip_AppendText': tooltip_AppendText,'legendText': legendTest[4],'yAxis_id': 1, 'yAxis_step': axisy_step,'type': 'bar','displayOrder': 1,'barIsStacked': true,'color':graphColor[4],'barStackId':1,'datalabel_rotation':datalabel_rotation,'datalabel_color':datalabelColor[4],'datalabel_fontSize':10};

		graphData.data = graphTimeData5;

		graphAllData.push(graphData);
	}

	graph.graphs=graphAllData;
	graph.axisLabels = axisLabels;

	await adapter.setStateAsync('summary.JSONGraph',{val:JSON.stringify(graph), ack:true});
	await adapter.setStateAsync('summary.JSONTable',{val:JSON.stringify(table), ack:true});

	const plant1_d_everyhour = adapter.config.plant1_everyhour;
	const plant2_d_everyhour = adapter.config.plant2_everyhour;
	const plant3_d_everyhour = adapter.config.plant3_everyhour;
	const plant4_d_everyhour = adapter.config.plant4_everyhour;
	const plant5_d_everyhour = adapter.config.plant5_everyhour;
	const plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];

	try {
		//adapter.log.debug("write zero to everyhour");
		// const nulldata = 0;
		for (let index = 1; index < 6; index++){
			if (plant_d_everyhour[index-1] == true && plant_active[index-1] == true) {

				adapter.log.debug('index: '+index+' plant_d_everyhour: '+ plant_d_everyhour[index-1] +'plant_active: ' +plant_active[index-1]);
				for (let j = 5; j < 22; j++) {
					for (let i = 0; i < 59; i = i + 15) {
						await adapter.setState('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00',{val: Number(nulldata), ack:true});
						await adapter.setState(index+'.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00',{val:Number(nulldata) , ack:true});
					}
				}
			}
		}

	}catch (e) {

	}


	await everyhour_data();

	const data_sql = adapter.config.sql1;
	const data_influxdb = adapter.config.influxdb1;
	const data_sql1 = adapter.config.actived_sql;
	const data_influxdb1 = adapter.config.actived_influxdb;

	adapter.log.debug('data_influxdb: ' + data_influxdb);
	// add Json Table to database
	if (data_influxdb != '' && data_influxdb1 == true) {
		const stateValue = await adapter.getStateAsync('summary.JSONTable');
		const result = JSON.parse(stateValue.val);
		adapter.log.debug('Summary JsonTable: ' + JSON.stringify(result));
		for(let i=0; i < result.length; i++){

			const ts = new Date(result[i].Uhrzeit);

			adapter.log.debug('Store Prognose: ' + ts.toLocaleDateString() + ' with ' + result[i].summe);

			await addToInfluxDB('summary.prognose',ts.getTime(),result[i].summe);
		}
	}
	if (data_sql != '' && data_sql1 == true) {
		const stateValue = await adapter.getStateAsync('summary.JSONTable');
		const result = JSON.parse(stateValue.val);
		adapter.log.debug('Summary JsonTable: ' + JSON.stringify(result));
		for(let i=0; i < result.length; i++){

			const ts = new Date(result[i].Uhrzeit);

			adapter.log.debug('Store Prognose SQL: ' + ts.toLocaleDateString() + ' with ' + result[i].summe);

			//  await addToSQL('summary.prognose',ts.getTime(),result[i].summe);

			const data_sql = adapter.config.sql1;
			adapter.sendTo(data_sql,'storeState', {
				id: 'summary.prognose',
				// rules: true,
				state: {
					ts: ts.getTime(),
					val: Number(result[i].summe),
					ack: true,
					from: 'pvforecast',
					//q: 0
				}
			});
		}
	}



}

// create or delete states from plants
async function create_delete_state (){
	try {
		const plant1_active1 = true;
		const plant2_active2 = adapter.config.plant2_active;
		const plant3_active3 = adapter.config.plant3_active;
		const plant4_active4 = adapter.config.plant4_active;
		const plant5_active5 = adapter.config.plant5_active;
		const plant_active = [plant1_active1, plant2_active2, plant3_active3, plant4_active4, plant5_active5];

		const plant1_d_everyhour = adapter.config.plant1_everyhour;
		const plant2_d_everyhour = adapter.config.plant2_everyhour;
		const plant3_d_everyhour = adapter.config.plant3_everyhour;
		const plant4_d_everyhour = adapter.config.plant4_everyhour;
		const plant5_d_everyhour = adapter.config.plant5_everyhour;
		const plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];

		//	adapter.log.debug("plant_active: "  + plant_active);

		const apikey = adapter.config.APIK;
		const weather_active = adapter.config.weather_active;

		adapter.log.debug('weather_active: ' + weather_active);
		const step = 0;
		if (weather_active == true ) {
			await adapter.setObjectNotExistsAsync('weather.object', {
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
			await adapter.setObjectNotExistsAsync('weather.datetime', {
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
			await adapter.setObjectNotExistsAsync('weather.sky', {
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
			await adapter.setObjectNotExistsAsync('weather.visibility', {
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
			await adapter.setObjectNotExistsAsync('weather.temperature', {
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
			await adapter.setObjectNotExistsAsync('weather.condition', {
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
			await adapter.setObjectNotExistsAsync('weather.icon', {
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
			await adapter.setObjectNotExistsAsync('weather.wind_speed', {
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
			await adapter.setObjectNotExistsAsync('weather.wind_degrees', {
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
			await adapter.setObjectNotExistsAsync('weather.wind_direction', {
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
		} else  if (weather_active == false) {
			await adapter.delObjectAsync('weather.object');
			await adapter.delObjectAsync('weather.datetime');
			await adapter.delObjectAsync('weather.sky');
			await adapter.delObjectAsync('weather.visibility');
			await adapter.delObjectAsync('weather.temperature');
			await adapter.delObjectAsync('weather.condition');
			await adapter.delObjectAsync('weather.icon');
			await adapter.delObjectAsync('weather.wind_speed');
			await adapter.delObjectAsync('weather.wind_degrees');
			await adapter.delObjectAsync('weather.wind_direction');
		}

		for (let index = 1; index < 6; index++) {
			if (plant_active[index-1] == true){
				await  adapter.setObjectNotExists(index + '.power_day_kWh', {
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
				await  adapter.setObjectNotExists(index + '.power_day_tomorrow_kWh',{
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
				await  adapter.setObjectNotExists(index + '.plantname',{
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
				await  adapter.setObjectNotExists(index + '.lastUpdated_object',{
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
				await  adapter.setObjectNotExists(index + '.place',{
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
				await  adapter.setObjectNotExists(index + '.object',{
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
				await  adapter.setObjectNotExists(index + '.power_kW',{
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
				await  adapter.setObjectNotExists(index + '.lastUpdated_data',{
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
				await  adapter.setObjectNotExists(index + '.power_kWh',{
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
				await  adapter.setObjectNotExists(index + '.transfer',{
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
				await  adapter.setObjectNotExists(index + '.JSONGraph',{
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
				await  adapter.setObjectNotExists(index + '.JSONTable',{
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
			} else if (plant_active[index-1] == false){

				await  adapter.delObjectAsync(index + '.JSONTable');
				await  adapter.delObjectAsync(index + '.JSONGraph');
				await  adapter.delObjectAsync(index + '.transfer');
				await  adapter.delObjectAsync(index + '.power_kWh');
				await  adapter.delObjectAsync(index + '.power_kW');
				await  adapter.delObjectAsync(index + '.object');
				await  adapter.delObjectAsync(index + '.place');
				await  adapter.delObjectAsync(index + '.lastUpdated_object');
				await  adapter.delObjectAsync(index + '.plantname');
				await  adapter.delObjectAsync(index + '.power_day_tomorrow_kWh');
				await  adapter.delObjectAsync(index + '.lastUpdated_data');
				await  adapter.delObjectAsync(index + '.power_day_kWh');
			}
		}

		//adapter.log.debug("plant-everyhour");
		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[index - 1] == true && plant_active[index - 1] == true) {
				for (let j = 5; j < 22; j++) {
					if (apikey !== '') {
						//adapter.log.debug('mit key');
						for (let i = 0; i < 59; i = i + 15) {
							await adapter.setObjectNotExists(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
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
					} else if(apikey == '') {
						//adapter.log.debug('ohne key');
						for (let i = 15; i < 50; i = i + 15) {
							//adapter.log.debug('apiky zeit: ' + i);
							await adapter.delObjectAsync(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':'+ (i <= 9 ? '0' + i : i) + ':00');
						}
						await adapter.setObjectNotExists(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
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
			} else if (plant_d_everyhour[index - 1] == false && plant_active[index - 1] == false){
				for (let j = 5; j < 22; j++) {
					for (let i = 0; i < 59; i = i + 15) {
						await adapter.delObjectAsync(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
					}
				}
			}
		}
		//	adapter.log.debug("summary");

		await adapter.setObjectNotExists('summary.prognose', {
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



		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[0] || plant_d_everyhour[1] ||plant_d_everyhour[2]||plant_d_everyhour[3]||plant_d_everyhour[4]) {
				for (let j = 5; j < 22; j++) {
					if (apikey !== '') {
						//adapter.log.debug('mit key');
						for (let i = 0; i < 59; i = i + 15) {
							await adapter.setObjectNotExists('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
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
					} else if(apikey == '') {
						//adapter.log.debug('ohne key');
						for (let i = 15; i < 50; i = i + 15) {
							//adapter.log.debug('apiky zeit: ' + i);
							await adapter.delObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':'+ (i <= 9 ? '0' + i : i) + ':00');
						}
						await adapter.setObjectNotExists('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
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
			} else if (plant_d_everyhour[index - 1] == false && plant_active[index - 1] == false){
				for (let j = 5; j < 22; j++) {
					for (let i = 0; i < 59; i = i + 15) {
						await adapter.delObjectAsync('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00');
					}
				}
			}
		}
	} catch (err) {
		// ignore
	}
}

// request weather data from server
async function getweather () {
	try {
		const weather_active = adapter.config.weather_active;
		const apikey_weater = adapter.config.APIK;
		const lon = adapter.config.longitude;
		const lat = adapter.config.latitude;
		const forcastUrl = adapter.config.linkdata;
		let url_weather1;

		url_weather1 = forcastUrl + '/' + apikey_weater + '/weather/' + lat + '/' + lon + '/';
		adapter.log.debug('url_weather1' + url_weather1);

		if (apikey_weater !== '') {
			if (weather_active) {
				if (url_weather1) {
					await axios
						.get(url_weather1)
						.then(async function (response) {
							adapter.log.debug('axios weather done');

							/*let weather_data1 = [];
                            weather_data1 = response.data.result;
                            //adapter.log.debug('Json weather axios ' + JSON.stringify(weather_data1));*/
							await adapter.setStateAsync('weather.object',{val:JSON.stringify(response.data.result), ack:true});

						})
						.catch(function (error) {
							if (error == 'Error: Request failed with status code 429') {
								adapter.log.error('too many data requests');
							} else if (error == 'Error: Request failed with status code 400') {
								adapter.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');
							} else {
								adapter.log.error('Axios Error ' + error);
							}
						});
				}
			}
		} else {
			adapter.log.error("you don't have an apikey");
		}
	} catch (e) {
	}
}

// analysis weather data
async function weather_data () {
	try {
		const stateValue = await adapter.getStateAsync('weather.object');
		//if (stateValue != '') {
		const d = new Date();
		const dd = d.getUTCDate();
		const mm = d.getUTCMonth() + 1;
		const yy= d.getUTCFullYear();
		const h = d.getHours();
		const m = d.getMinutes();
		const uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
		const datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

		let a;
		const obj = JSON.parse(stateValue.val);

		for(let i=0; i< obj.length; i++) {
			a = obj[i].datetime.indexOf( datum + ' ' + uhrzeit +':00');
			if(a !== -1){
				adapter.log.debug('a' + a);
				adapter.log.debug('i true' + i);
				adapter.log.debug('sky' + obj[i].sky);
				adapter.log.debug('datetime' + obj[i].datetime);
				adapter.log.debug('visibility' + obj[i].visibility);
				adapter.log.debug('temperature' + obj[i].temperature);
				adapter.log.debug('condition' + obj[i].condition);
				adapter.log.debug('icon' + obj[i].icon);
				adapter.log.debug('wind_speed' + obj[i].wind_speed);
				adapter.log.debug('wind_degrees' + obj[i].wind_degrees);
				adapter.log.debug('wind_direction' + obj[i].wind_direction);

				await adapter.setStateAsync('weather.sky',{val:Number(obj[i].sky), ack:true});
				await adapter.setStateAsync('weather.datetime',{val:obj[i].datetime, ack:true});
				await adapter.setStateAsync('weather.visibility',{val:Number(obj[i].visibility), ack:true});
				await adapter.setStateAsync('weather.temperature',{val:Number(obj[i].temperature), ack:true});
				await adapter.setStateAsync('weather.condition',{val:obj[i].condition, ack:true});
				await adapter.setStateAsync('weather.icon',{val:obj[i].icon, ack:true});
				await adapter.setStateAsync('weather.wind_speed',{val:Number(obj[i].wind_speed), ack:true});
				await adapter.setStateAsync('weather.wind_degrees',{val:Number(obj[i].wind_degrees), ack:true});
				await adapter.setStateAsync('weather.wind_direction',{val:obj[i].wind_direction, ack:true});
			}
		}
		//}
		// eslint-disable-next-line no-empty
	}catch (e) {
	}
}

//datapoint for everytime
async function everyhour_data () {
	try {
		const plant1_active1 = true;
		const plant2_active2 = adapter.config.plant2_active;
		const plant3_active3 = adapter.config.plant3_active;
		const plant4_active4 = adapter.config.plant4_active;
		const plant5_active5 = adapter.config.plant5_active;
		const plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];
		adapter.log.debug('everhour - plant_active: ' + plant_active);
		const plant1_d_everyhour = adapter.config.plant1_everyhour;
		const plant2_d_everyhour = adapter.config.plant2_everyhour;
		const plant3_d_everyhour = adapter.config.plant3_everyhour;
		const plant4_d_everyhour = adapter.config.plant4_everyhour;
		const plant5_d_everyhour = adapter.config.plant5_everyhour;
		const plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];
		adapter.log.debug('everhour - plant_d_everyhour: ' + plant_d_everyhour);
		const apikey = adapter.config.APIK;

		const uebergabe_power_kw1 = 0;	const uebergabe_power_kw2 = 0;	const uebergabe_power_kw3 = 0;	const uebergabe_power_kw4 = 0;	const uebergabe_power_kw5 = 0;
		const uebergabe_power_kwh1 = 0;	const uebergabe_power_kwh2 = 0;	const uebergabe_power_kwh3 = 0;	const uebergabe_power_kwh4 = 0;	const uebergabe_power_kwh5 = 0;

		const uebergabe_power_kw = [uebergabe_power_kw1,uebergabe_power_kw2,uebergabe_power_kw3,uebergabe_power_kw4,uebergabe_power_kw5];
		const uebergabe_power_kwh = [uebergabe_power_kwh1,uebergabe_power_kwh2,uebergabe_power_kwh3,uebergabe_power_kwh4,uebergabe_power_kwh5];

		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[index - 1] === true && plant_active[index - 1] === true) {
				for (let j = 5; j < 22; j++) {
					if (apikey !== '') {
						//adapter.log.debug("mit key");
						for (let i = 0; i < 59; i = i + 15) {
							await adapter.setState(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
								val: Number(0),
								ack: true
							});
						}
					} else {
					//	adapter.log.debug("ohne key");
						await adapter.setStateAsync(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':00:00', {
							val: Number(0),
							ack: true
						});
					}
				}
			}
		}
		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[index-1] == true && plant_active[index-1] == true) {
				const stateValue = await adapter.getStateAsync(index + '.object');
				if (stateValue.val !== '') {
					const obj2 = JSON.parse(stateValue.val).result;
					uebergabe_power_kw[index] = obj2.watts;
					uebergabe_power_kwh[index] = obj2.watt_hours;
				}
			}
		}

		adapter.log.debug('everhour - uebergabe_power_kw: ' + uebergabe_power_kw);
		adapter.log.debug('everhour - uebergabe_power_kwh: ' + uebergabe_power_kwh);

		const watts1 = uebergabe_power_kw[1]; const	watts2 = uebergabe_power_kw[2]; const	watts3 = uebergabe_power_kw[3]; const	watts4 = uebergabe_power_kw[4]; const	watts5 = uebergabe_power_kw[5];

		let watts1_data;	let watts2_data;	let watts3_data;	let watts4_data;	let watts5_data;

		let pos1;	let pos2;	let pos3;	let pos4;let  pos5;
		let year;	let month;	let day;	let today;
		for(const time in watts1) {
			pos1 = -1; pos2 = -1; pos3 = -1; pos4 = -1; pos5 = -1;
			year = -1; month = -1; day = -1; today = -1;
			today = new Date();
			month = today.getUTCMonth() +1;
			year = today.getUTCFullYear();
			day = today.getUTCDate();
			month = (month <= 9 ? '0' + month : month);
			day = (day <= 9 ? '0'+ day : day);
			pos5 = time.indexOf(year+'-'+ month  + '-'+day);

			/*adapter.log.debug("month:"+ month);
            adapter.log.debug("year:"+year);
            adapter.log.debug("day:"+ day);
            adapter.log.debug("time:"+time);
            adapter.log.debug("time.sub: "+time.substr(-8,2));*/

			if(apikey !== ''){
				//adapter.log.debug('erveryhour_filter_an');
				pos1 = time.indexOf(time.substr(-8,2)+':00:00');
				pos2 = time.indexOf(':15:00');
				pos3 = time.indexOf(':30:00');
				pos4 = time.indexOf(':45:00');
			} else {
				//adapter.log.debug('erveryhour_filter_aus');
				pos1 = time.indexOf(time.substr(-8,2)+':00:00');
			}

			adapter.log.debug('pos1: '+ pos1 + ' - pos2: '+ pos2 + '- pos3: ' + pos3 + ' - pos4: '+ pos4 + ' - pos5: '+ pos5);

			if ((pos1 != -1 && pos5 != -1) || (pos2 != -1 && pos5 != -1) || (pos3 != -1 && pos5 != -1) || (pos4 != -1 && pos5 != -1))  {

				const time2 =time.substr(-8,8);

				//adapter.log.debug("time2"+time2);
				if (plant_d_everyhour[0] === true && plant_active[0] === true){
					watts1_data =  JSON.parse(watts1[time]);
					watts1_data = watts1_data /1000;
					await adapter.setStateAsync('1.everyhour_kw.' + time2,{val: Number(watts1_data), ack:true});
					adapter.log.debug('watts1_data'+ watts1_data);
				}
				if (plant_d_everyhour[1] === true && plant_active[1] === true){
					watts2_data =  JSON.parse(watts2[time]);
					watts2_data = watts2_data /1000;
					await adapter.setStateAsync('2.everyhour_kw.' + time2,{val: Number(watts2_data), ack:true});
					adapter.log.debug('watts2_data'+ watts2_data);
				}
				if (plant_d_everyhour[2] === true && plant_active[2] === true){
					watts3_data =  JSON.parse(watts3[time]);
					watts3_data = watts2_data /1000;
					await adapter.setStateAsync('3.everyhour_kw.' + time2,{val: Number(watts3_data), ack:true});
					//adapter.log.debug("watts3_data"+ watts3_data);
				}
				if (plant_d_everyhour[3] === true && plant_active[3] === true){
					watts4_data =  JSON.parse(watts4[time]);
					watts4_data = watts4_data /1000;
					await adapter.setStateAsync('4.everyhour_kw.' + time2,{val: Number(watts4_data), ack:true});
					//adapter.log.debug("watts4_data"+ watts4_data);
				}
				if (plant_d_everyhour[4] === true && plant_active[4] === true){
					watts5_data =  JSON.parse(watts5[time]);
					watts5_data = watts5_data /1000;
					await adapter.setStateAsync('5.everyhour_kw.' + time2,{val: Number(watts5_data), ack:true});
					//adapter.log.debug("watts5_data"+ watts5_data);
				}

				if (plant_d_everyhour[0] === true || plant_d_everyhour[1] === true || plant_d_everyhour[2] === true || plant_d_everyhour[3] === true || plant_d_everyhour[4] === true) {

					if(watts1_data == null){watts1_data = 0;}
					if(watts2_data == null){watts2_data = 0;}
					if(watts3_data == null){watts3_data = 0;}
					if(watts4_data == null){watts4_data = 0;}
					if(watts5_data == null){watts5_data = 0;}

					const a = watts1_data + watts2_data + watts3_data + watts4_data + watts5_data;
					adapter.log.debug('everyhour_summary' + a);

					await adapter.setStateAsync('summary.everyhour_kw.' + time2, {val: Number(a), ack: true});
				}
			}
		}
	} catch (e) {

	}
}
//await addToInfluxDB('summary.prognose',ts.getTime(),result[i].summe);

async function addToInfluxDB(datapoint,timestamp,value) {
	try {
		const data_influxdb = adapter.config.influxdb1;
		adapter.sendTo(data_influxdb,'storeState', {
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
		adapter.log.error('Datenbank: ' + e);
	}

}

async function addToSQL(datapoint,timestamp,value) {
	try {

		const data_sql = adapter.config.sql1;
		adapter.sendTo(data_sql,'storeState', {
			id: datapoint,
			rules: true,
			state: {
				ts: timestamp,
				val: Number(value),
				ack: true,
				from: 'pvforecast',
				//q: 0
			}
		});

		/*adapter.sendTo(data_sql,'storeState', {
                id: datapoint,
                rules: true,
                state: {val: Number(value), ts: timestamp}
            });*/

	} catch (e) {
		adapter.log.error('Datenbank SQL: ' + e);
	}

}
