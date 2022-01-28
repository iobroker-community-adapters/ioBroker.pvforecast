
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
var adapter = new utils.Adapter('pvforecast');

let thisUrl ='';

const tooltip_AppendText= " Watt";

var pvname1 = ''; var pvname2 = ''; var pvname3 = ''; var pvname4 = ''; var pvname5 = '';
var options1 = ''; var options2 = ''; var options3 = ''; var options4 = ''; var options5 = '';
var urls = [options1,options2,options3,options4,options5];

let power_kw1 = 0; let power_kw2 = 0; let power_kw3 = 0; let power_kw4 = 0; let power_kw5 = 0;
let power_kwh1 = 0; let power_kwh2 = 0; let power_kwh3 = 0; let power_kwh4 = 0; let power_kwh5 = 0;
let power_kw = [power_kw1,power_kw2,power_kw3,power_kw4,power_kw5];
let power_kwh = [power_kwh1,power_kwh2,power_kwh3,power_kwh4,power_kwh5];

var watts_tomorrow_plants1 = 0; var watts_tomorrow_plants2 = 0; var watts_tomorrow_plants3 = 0; var watts_tomorrow_plants4 = 0; var watts_tomorrow_plants5 = 0;
var watts_tag_plants1 = 0; var watts_tag_plants2 = 0; var watts_tag_plants3 = 0; var watts_tag_plants4 = 0; var watts_tag_plants5 = 0;
var watts_tomorrow_plants = [watts_tomorrow_plants1,watts_tomorrow_plants2,watts_tomorrow_plants3,watts_tomorrow_plants4,watts_tomorrow_plants5];
var watts_tag_plants = [watts_tag_plants1,watts_tag_plants2,watts_tag_plants3,watts_tag_plants4,watts_tag_plants5];
let data_tschedule = '';

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
	try {
		adapter.log.debug('cleaned everything up...');
		clearTimeout(timer);
		schedule.cancelJob('datenauswerten');

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
		let data_adapter_timeout = adapter.config.timeout;
		let data_timeout;
		if(data_adapter_timeout !=''){
			data_timeout =data_adapter_timeout * 1000;
		}else{
			data_timeout = 10000;
		}

		adapter.log.debug("timeout eingabe: " + data_timeout /1000 + " sec");
		setTimeout(async  function() {await getPV(); }, data_timeout);
		//await getPV();

		data_tschedule = adapter.config.tschedule;

		if (data_tschedule != '') {
			data_tschedule = adapter.config.tschedule;
			adapter.log.debug("tschedule eingabe: " + data_tschedule + " min");
			data_tschedule = 60000 * data_tschedule;
		} else {
			data_tschedule = 3600000;
			adapter.log.debug("tschedule standart: " + data_tschedule / 60000 + " min");
		}
		var timer = setInterval(datenübertragen, data_tschedule); //360000

		let weather_active = adapter.config.weather_active;

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

		let weather_active = adapter.config.weather_active;
		if(weather_active == true) {
			await getweather ();
		}
	} catch (e) {

	}

}

// evaluate data from json to data point every minute
const calc2 = schedule.scheduleJob('datenauswerten', '* * * * *', async function () {
try {
	let weather_active = adapter.config.weather_active;
	if(weather_active == true) {
		await weather_data();
	}

	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_active;
	let plant3_active3 = adapter.config.plant3_active;
	let plant4_active4 = adapter.config.plant4_active;
	let plant5_active5 = adapter.config.plant5_active;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

	var d = new Date();
	var dd = d.getUTCDate();
	var mm = d.getUTCMonth() + 1;
	var yy= d.getUTCFullYear();
	var h = d.getHours();
	var m = d.getMinutes();
	var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
	var datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
	var datetime1 = datum + ' ' + uhrzeit;

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

		adapter.log.debug("summary.power_kw: " + JSON.stringify(power_kw));
		adapter.log.debug("summary.power_kwh : " + JSON.stringify(power_kwh));

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

	adapter.log.debug("getpv");
	//Variablen zur Übergabe und Prüfen der Einträge im Admin
	//main
	let forcastUrl = adapter.config.linkdata; //var account = adapter.config.account;
	/*var settinggpsiobroker = adapter.config.settingsiobroker; */
	let apikey = adapter.config.APIK; let lon = adapter.config.longitude; let lat  = adapter.config.latitude;

	//plant1
	let Neigung1 = adapter.config.tilt1;
	let Azimuth1 = adapter.config.Azimuth1;
	let Anlagenleistung1 = adapter.config.Plantp1;pvname1 = adapter.config.pvname1;

	//plant2
	let Neigung2 = adapter.config.tilt2;
	let Azimuth2 = adapter.config.Azimuth2;
	let Anlagenleistung2 = adapter.config.Plantp2;	pvname2 = adapter.config.pvname2;

	//plant3
	let Neigung3 = adapter.config.tilt3;
	let Azimuth3 = adapter.config.Azimuth3;
	let Anlagenleistung3 = adapter.config.Plantp3;	pvname3 = adapter.config.pvname3;

	//plant4
	let Neigung4 = adapter.config.tilt4;
	let Azimuth4 = adapter.config.Azimuth4
	let Anlagenleistung4 = adapter.config.Plantp4;	pvname4 = adapter.config.pvname4;

	//plant5
	let Neigung5 = adapter.config.tilt5;
	let Azimuth5 = adapter.config.Azimuth5;
	let Anlagenleistung5 = adapter.config.Plantp5; pvname5 = adapter.config.pvname5;


	//Data from settings user interface
	let legend1 = adapter.config.legend1;
	let graphcolor1 = adapter.config.graphcolor1;
	let datalabelColor1 = adapter.config.datalabelColor1;

	let legend2 = adapter.config.legend2;
	let graphcolor2 = adapter.config.graphcolor2;
	let datalabelColor2 = adapter.config.datalabelColor2;

	let legend3 = adapter.config.legend3;
	let graphcolor3 = adapter.config.graphcolor3;
	let datalabelColor3 = adapter.config.datalabelColor3;

	let legend4 = adapter.config.legend4;
	let graphcolor4 = adapter.config.graphcolor4;
	let datalabelColor4 = adapter.config.datalabelColor4;

	let legend5 = adapter.config.legend5;
	let graphcolor5 = adapter.config.graphcolor5;
	let datalabelColor5 = adapter.config.datalabelColor5;

	let axisy_step = adapter.config.axisy_step1;
	let datalabel_rotation = adapter.config.datalabel_rotation1;
	let pvname = [pvname1,pvname2,pvname3,pvname4,pvname5];

	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_active;
	let plant3_active3 = adapter.config.plant3_active;
	let plant4_active4 = adapter.config.plant4_active;
	let plant5_active5 = adapter.config.plant5_active;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

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
	adapter.log.debug("Längengrad: " + lon + "	Breitengrad: " + lat);
	adapter.log.debug("urls: " + urls[0]);
	adapter.log.debug("Plant1 -> tilt: " + Neigung1 + " Azimuth: " + Azimuth1 + " Plant-performance: " + Anlagenleistung1 + " plant name: " + pvname1);

	if (plant2_active2 == true){
		urls[1]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[1]+'/'+azimuth[1]+'/'+kwp[1]
		adapter.log.debug("urls: " + urls[1]);
		adapter.log.debug("Plant2 -> tilt: " + Neigung2 + " Azimuth: " + Azimuth2 + " Plant-performance: " + Anlagenleistung2 + " plant name: " + pvname2);
	}
	if (plant3_active3 == true){
		urls[2]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[2]+'/'+azimuth[2]+'/'+kwp[2]
		adapter.log.debug("urls: " + urls[2]);
		adapter.log.debug("Plant3 -> tilt: " + Neigung3 + " Azimuth: " + Azimuth3 + " Plant-performance: " + Anlagenleistung3 + " plant name: " + pvname3);
	}
	if (plant4_active4 == true){
		urls[3]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[3]+'/'+azimuth[3]+'/'+kwp[3];
		adapter.log.debug("urls: " + urls[3]);
		adapter.log.debug("Plant4 -> tilt: " + Neigung4 + " Azimuth: " + Azimuth4 + " Plant-performance: " + Anlagenleistung4 + " plant name: " + pvname4);
	}
	if (plant5_active5 == true){
		urls[4]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[4]+'/'+azimuth[4]+'/'+kwp[4];
		adapter.log.debug("urls: " + urls[4]);
		adapter.log.debug("Plant5 -> tilt: " + Neigung5 + " Azimuth: " + Azimuth5 + " Plant-performance: " + Anlagenleistung5 + " plant name: " + pvname5);
	}
//date from today and tomorrow
	var d = new Date();
	var dd = d.getUTCDate();
	var mm = d.getUTCMonth() + 1;
	var yy= d.getUTCFullYear();
	var h = d.getHours();
	var m = d.getMinutes();
	var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
	var data_today = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

	//var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd); //aktueller tag

	var datetime =data_today + ' ' + uhrzeit;


//heute = heute.getDate();
	let vorhersage_d_tag1=0;
	let vorhersage_d_tag2=0;
	let vorhersage_d_tag3=0;
	let vorhersage_d_tag4=0;
	let vorhersage_d_tag5=0;
	let vorhersage_d_tag6=0;
	let vorhersage_d_tag7=0;
	let vorhersage_datum = [vorhersage_d_tag1,vorhersage_d_tag2,vorhersage_d_tag3,vorhersage_d_tag4,vorhersage_d_tag5,vorhersage_d_tag6,vorhersage_d_tag7]
	let heute = new Date();
	//let morgen = new Date(heute.getTime()); // übermorgen wäre dann am Ende eine 2 anstatt 1

	for (let i = 0; i < 8; i++) {
		let tag_uebergabe = new Date(heute.getTime() + (1000 * 60 * 60 * 24 * i)); // übermorgen wäre dann am Ende eine 2 anstatt 1
		vorhersage_datum[i] = tag_uebergabe.getDate();
	}

	//adapter.log.debug("'"vorhersage_datum' + vorhersage_datum);
	var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[0] <= 9 ? '0' + vorhersage_datum[0] : vorhersage_datum[0]);
	var date_2 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[1] <= 9 ? '0' + vorhersage_datum[1] : vorhersage_datum[1]);
	/*var date_3 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[2] <= 9 ? '0' + vorhersage_datum[2] : vorhersage_datum[2]);
	var date_4 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[3] <= 9 ? '0' + vorhersage_datum[3] : vorhersage_datum[3]);
	var date_5 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[4] <= 9 ? '0' + vorhersage_datum[4] : vorhersage_datum[4]);
	var date_6 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[5] <= 9 ? '0' + vorhersage_datum[5] : vorhersage_datum[5]);
	var date_7 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[6] <= 9 ? '0' + vorhersage_datum[6] : vorhersage_datum[6]);
*/
	adapter.log.debug("plant_active: " + plant_active);
	adapter.log.debug("pvname: " + pvname);

	//data to datapoints |graph | table
	for (let url_read of urls) {
		thisUrl = url_read;
		adapter.log.debug("ThisUrl "+thisUrl);
		if (thisUrl) {
			adapter.log.debug("axios start");
			await axios
				.get(thisUrl)
				.then (async function(response) {
					adapter.log.debug("axios done");

					let res = response.data.result;
					let res2 = response.data.message;
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

					let watts = res.watts;

					//jsongraph
					let table = [];

					for(let time in watts) {
						let entry = {};

						entry.Uhrzeit = time;
						entry.Leistung = watts[time];
						table.push(entry);
					}

					await adapter.setStateAsync(url_read_index + '.JSONTable',{val:JSON.stringify(table), ack:true});

					// GraphTable
					let graphTimeData = [];

					for(let time in watts) {
						let graphEntry ={};
						graphEntry.t = Date.parse(time);
						graphEntry.y = watts[time];
						graphTimeData.push(graphEntry);
					}

					var graph = {};
					var graphData = {"tooltip_AppendText":  tooltip_AppendText,"legendText": legendTest[url_read_index],"yAxis_id":  url_read_index   ,"type": "bar","displayOrder": 2,"barIsStacked": true,"color":graphColor[url_read_index],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[url_read_index],"datalabel_fontSize":10};
					var graphAllData = [];

					graphData.data = graphTimeData;
					graphAllData.push(graphData);
					graph.graphs=graphAllData;

					await adapter.setStateAsync(url_read_index + '.JSONGraph',{val:JSON.stringify(graph), ack:true});

				})
				.catch(function(error) {
					if (error == "Error: Request failed with status code 429"){
						adapter.log.error("too many data requests");
					} else if (error == "Error: Request failed with status code 400"){
						adapter.log.error("entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude");
					} else if (error == "Error: Request failed with status code 404"){
						adapter.log.error("Error: Not Found");
					} else if (error == "Error: Request failed with status code 502"){
						adapter.log.error("Error: Bad Gateway");
					} else {
						adapter.log.error("Axios Error "+ error);
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

	adapter.log.debug("summary.power_day_kWh:" + wattstunden_tag_summary + ' summary.power_day_tomorrow_kWh: ' + wattstunden_tag_tomorrow_summary);

	await adapter.setStateAsync('summary.power_day_kWh',{val:Number(wattstunden_tag_summary), ack:true});
	await adapter.setStateAsync('summary.power_day_tomorrow_kWh',{val: Number(wattstunden_tag_tomorrow_summary), ack:true});

	let uebergabe_power_kw1 = 0;	let uebergabe_power_kw2 = 0;	let uebergabe_power_kw3 = 0;	let uebergabe_power_kw4 = 0;	let uebergabe_power_kw5 = 0;
	let uebergabe_power_kwh1 = 0;	let uebergabe_power_kwh2 = 0;	let uebergabe_power_kwh3 = 0;	let uebergabe_power_kwh4 = 0;	let uebergabe_power_kwh5 = 0;

	var uebergabe_power_kw = [uebergabe_power_kw1,uebergabe_power_kw2,uebergabe_power_kw3,uebergabe_power_kw4,uebergabe_power_kw5];
	var uebergabe_power_kwh = [uebergabe_power_kwh1,uebergabe_power_kwh2,uebergabe_power_kwh3,uebergabe_power_kwh4,uebergabe_power_kwh5];

	for (let index = 1; index < 6; index++) {
		if (plant_active[index-1] == true) {
			const stateValue = await adapter.getStateAsync(index + '.object');
			if (stateValue.val !== ''){
				var obj2 = JSON.parse(stateValue.val).result;
				uebergabe_power_kw[index] = obj2.watts;
				uebergabe_power_kwh[index] = obj2.watt_hours;
				let obj5 = JSON.parse(stateValue.val).message;
				let place1 = obj5.info.place;
				let type1 = obj5.type;
				adapter.log.debug(index + ".transfer: " + type1);
				adapter.log.debug(index + ".place: " + place1);
				await adapter.setStateAsync(index + '.transfer', {val: type1, ack: true});
				await adapter.setStateAsync(index + '.place', {val: place1, ack: true});
			}
		}
	}


	adapter.log.debug("vorübergabe_power_kw[0]: " + JSON.stringify(uebergabe_power_kw[0]));
	adapter.log.debug("vorübergabe_power_kw[1]: " + JSON.stringify(uebergabe_power_kw[1]));
	adapter.log.debug("vorübergabe_power_kw[2]: " + JSON.stringify(uebergabe_power_kw[2]));
	adapter.log.debug("vorübergabe_power_kw[3]: " + JSON.stringify(uebergabe_power_kw[3]));
	adapter.log.debug("vorübergabe_power_kw[4]: " + JSON.stringify(uebergabe_power_kw[4]));

	var graph = {}; let table = []; let axisLabels = [];

	let watts1 = uebergabe_power_kw[1]; let	watts2 = uebergabe_power_kw[2]; let	watts3 = uebergabe_power_kw[3]; let	watts4 = uebergabe_power_kw[4]; let	watts5 = uebergabe_power_kw[5];



	for(let time in watts1) {

		let pos1 = time.indexOf(':00:00');
		let pos2 = time.indexOf(':15:00');
		let pos3 = time.indexOf(':30:00');
		let pos4 = time.indexOf(':45:00');

		if((pos1 !== -1) || (pos2 !== -1)|| (pos3 !== -1)|| (pos4 !== -1)) {
			let entry = {};
			entry.Uhrzeit = time;
			entry.Leistung1 = watts1[time];
			if (plant2_active2){entry.Leistung2 = watts2[time]}
			if (plant3_active3){entry.Leistung3 = watts3[time]}
			if (plant4_active4){entry.Leistung4 = watts4[time]}
			if (plant5_active5){entry.Leistung5 = watts5[time]}
			if (plant1_active1 ){entry.summe = watts1[time]}
			if (plant2_active2 ){entry.summe = watts1[time] +  watts2[time]}
			if (plant2_active2  && plant3_active3){entry.summe = watts1[time] +  watts2[time] +  watts3[time]}
			if (plant2_active2  && plant3_active3  &&  plant4_active4){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time]}
			if (plant2_active2  && plant3_active3  &&  plant4_active4 &&  plant5_active5){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time] +  watts5[time]}

			table.push(entry);
		}
	}

	// prepare data for graph

	let graphTimeData1 = []; let graphTimeData2 = []; let graphTimeData3 = []; let graphTimeData4 = []; let graphTimeData5 = [];

	for(let time in watts1) {
		let m = time;
		axisLabels.push(m);
	}

	for(let time in watts1) {
		graphTimeData1.push(watts1[time]);
	}

	for(let time in watts2) {
		graphTimeData2.push(watts2[time]);
	}

	for(let time in watts3) {
		graphTimeData3.push(watts3[time]);
	}

	for(let time in watts4) {
		graphTimeData4.push(watts4[time]);
	}

	for(let time in watts5) {
		graphTimeData5.push(watts5[time]);
	}

	var graphAllData = [];

	var graphData = {"tooltip_AppendText":  tooltip_AppendText,"legendText": legendTest[0],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 2,"barIsStacked": true,"color":graphColor[0],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[0],"datalabel_fontSize":10};

	graphData.data = graphTimeData1;

	graphAllData.push(graphData);

	if (plant2_active2){

		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[1],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[1],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[1],"datalabel_fontSize":10};

		graphData.data = graphTimeData2;

		graphAllData.push(graphData);
	}

	if (plant3_active3){

		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[2],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[2],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[2],"datalabel_fontSize":10};

		graphData.data = graphTimeData3;

		graphAllData.push(graphData);
	}

	if (plant4_active4){

		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[3],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[3],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[3],"datalabel_fontSize":10};

		graphData.data = graphTimeData4;

		graphAllData.push(graphData);
	}

	if (plant5_active5){
		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[4],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[4],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[4],"datalabel_fontSize":10};

		graphData.data = graphTimeData5;

		graphAllData.push(graphData);
	}

	graph.graphs=graphAllData;
	graph.axisLabels = axisLabels;

	await adapter.setStateAsync('summary.JSONGraph',{val:JSON.stringify(graph), ack:true});
	await adapter.setStateAsync('summary.JSONTable',{val:JSON.stringify(table), ack:true});

	let plant1_d_everyhour = adapter.config.plant1_everyhour;
	let plant2_d_everyhour = adapter.config.plant2_everyhour;
	let plant3_d_everyhour = adapter.config.plant3_everyhour;
	let plant4_d_everyhour = adapter.config.plant4_everyhour;
	let plant5_d_everyhour = adapter.config.plant5_everyhour;
	let plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];

	try {
		//adapter.log.debug("write zero to everyhour");
		// const nulldata = 0;
		for (let index = 1; index < 6; index++){
			if (plant_d_everyhour[index-1] == true && plant_active[index-1] == true) {

				adapter.log.debug("index: "+index+" plant_d_everyhour: "+ plant_d_everyhour[index-1] +"plant_active: " +plant_active[index-1]);
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
}

// create or delete states from plants
async function create_delete_state (){
	try {
		let plant1_active1 = true;
		let plant2_active2 = adapter.config.plant2_active;
		let plant3_active3 = adapter.config.plant3_active;
		let plant4_active4 = adapter.config.plant4_active;
		let plant5_active5 = adapter.config.plant5_active;
		let plant_active = [plant1_active1, plant2_active2, plant3_active3, plant4_active4, plant5_active5];

		let plant1_d_everyhour = adapter.config.plant1_everyhour;
		let plant2_d_everyhour = adapter.config.plant2_everyhour;
		let plant3_d_everyhour = adapter.config.plant3_everyhour;
		let plant4_d_everyhour = adapter.config.plant4_everyhour;
		let plant5_d_everyhour = adapter.config.plant5_everyhour;
		let plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];

	//	adapter.log.debug("plant_active: "  + plant_active);

		let apikey = adapter.config.APIK;
		let weather_active = adapter.config.weather_active;

		adapter.log.debug("weather_active: " + weather_active);
		let step = 0;
		if (weather_active == true ) {
			await adapter.setObjectNotExistsAsync('weather.object', {
				type: 'state',
				common: {
					name: "object",
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
					name: "date.time",
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
					name: "sky",
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
					name: "visibility",
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
					name: "temperature",
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
					name: "condition",
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
					name: "icon",
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
					name: "wind_speed",
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
					name: "wind_degrees",
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
					name: "wind_direction",
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
						name: "power_day_kWh",
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
						name: "power_day_tomorrow_kWh",
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
						name: "plantname",
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
						name: "lastUpdated",
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
						name: "place",
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
						name: "object",
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
						name: "power_kW",
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
						name: "lastUpdated_data",
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
						name: "power_kWh",
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
						name: "transfer",
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
						name: "JSONGraph",
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
						name: "JSONTable",
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
									name: "power_kW",
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
								name: "power_kW",
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
		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[0] || plant_d_everyhour[1] ||plant_d_everyhour[2]||plant_d_everyhour[3]||plant_d_everyhour[4]) {
				for (let j = 5; j < 22; j++) {
					if (apikey !== '') {
						//adapter.log.debug('mit key');
						for (let i = 0; i < 59; i = i + 15) {
							await adapter.setObjectNotExists('summary.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
								type: 'state',
								common: {
									name: "power_kW",
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
								name: "power_kW",
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
		let weather_active = adapter.config.weather_active;
		let apikey_weater = adapter.config.APIK;
		let lon = adapter.config.longitude
		let lat = adapter.config.latitude;
		let forcastUrl = adapter.config.linkdata;
		let url_weather1;

		url_weather1 = forcastUrl + '/' + apikey_weater + '/weather/' + lat + '/' + lon + '/';
		adapter.log.debug("url_weather1" + url_weather1);

		if (apikey_weater !== '') {
			if (weather_active) {
				if (url_weather1) {
					await axios
						.get(url_weather1)
						.then(async function (response) {
							adapter.log.debug("axios weather done");

							/*let weather_data1 = [];
                            weather_data1 = response.data.result;
                            //adapter.log.debug('Json weather axios ' + JSON.stringify(weather_data1));*/
							await adapter.setStateAsync('weather.object',{val:JSON.stringify(response.data.result), ack:true});

						})
						.catch(function (error) {
							if (error == "Error: Request failed with status code 429") {
								adapter.log.error("too many data requests");
							} else if (error == "Error: Request failed with status code 400") {
								adapter.log.error("entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude");
							} else {
								adapter.log.error("Axios Error " + error);
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
			var d = new Date();
			var dd = d.getUTCDate();
			var mm = d.getUTCMonth() + 1;
			var yy= d.getUTCFullYear();
			var h = d.getHours();
			var m = d.getMinutes();
			var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
			var datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

			let a;
			let obj = JSON.parse(stateValue.val);

			for(let i=0; i< obj.length; i++) {
				a = obj[i].datetime.indexOf( datum + ' ' + uhrzeit +':00')
				if(a !== -1){
					adapter.log.debug("a" + a);
					adapter.log.debug("i true" + i);
					adapter.log.debug("sky" + obj[i].sky);
					adapter.log.debug("datetime" + obj[i].datetime);
					adapter.log.debug("visibility" + obj[i].visibility);
					adapter.log.debug("temperature" + obj[i].temperature);
					adapter.log.debug("condition" + obj[i].condition);
					adapter.log.debug("icon" + obj[i].icon);
					adapter.log.debug("wind_speed" + obj[i].wind_speed);
					adapter.log.debug("wind_degrees" + obj[i].wind_degrees);
					adapter.log.debug("wind_direction" + obj[i].wind_direction);

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
		let plant1_active1 = true;
		let plant2_active2 = adapter.config.plant2_active;
		let plant3_active3 = adapter.config.plant3_active;
		let plant4_active4 = adapter.config.plant4_active;
		let plant5_active5 = adapter.config.plant5_active;
		let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];
		adapter.log.debug("everhour - plant_active: " + plant_active);
		let plant1_d_everyhour = adapter.config.plant1_everyhour;
		let plant2_d_everyhour = adapter.config.plant2_everyhour;
		let plant3_d_everyhour = adapter.config.plant3_everyhour;
		let plant4_d_everyhour = adapter.config.plant4_everyhour;
		let plant5_d_everyhour = adapter.config.plant5_everyhour;
		let plant_d_everyhour = [plant1_d_everyhour, plant2_d_everyhour, plant3_d_everyhour, plant4_d_everyhour, plant5_d_everyhour];
		adapter.log.debug("everhour - plant_d_everyhour: " + plant_d_everyhour);
		let apikey = adapter.config.APIK;

		let uebergabe_power_kw1 = 0;	let uebergabe_power_kw2 = 0;	let uebergabe_power_kw3 = 0;	let uebergabe_power_kw4 = 0;	let uebergabe_power_kw5 = 0;
		let uebergabe_power_kwh1 = 0;	let uebergabe_power_kwh2 = 0;	let uebergabe_power_kwh3 = 0;	let uebergabe_power_kwh4 = 0;	let uebergabe_power_kwh5 = 0;

		var uebergabe_power_kw = [uebergabe_power_kw1,uebergabe_power_kw2,uebergabe_power_kw3,uebergabe_power_kw4,uebergabe_power_kw5];
		var uebergabe_power_kwh = [uebergabe_power_kwh1,uebergabe_power_kwh2,uebergabe_power_kwh3,uebergabe_power_kwh4,uebergabe_power_kwh5];

		for (let index = 1; index < 6; index++) {
			if (plant_d_everyhour[index - 1] === true && plant_active[index - 1] === true) {
				for (let j = 5; j < 22; j++) {
					if (apikey !== '') {
						adapter.log.debug("mit key");
						for (let i = 0; i < 59; i = i + 15) {
							await adapter.setState(index + '.everyhour_kw.' + (j <= 9 ? '0' + j : j) + ':' + (i <= 9 ? '0' + i : i) + ':00', {
								val: Number(0),
								ack: true
							});
						}
					} else {
						adapter.log.debug("ohne key");
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
					var obj2 = JSON.parse(stateValue.val).result;
					uebergabe_power_kw[index] = obj2.watts;
					uebergabe_power_kwh[index] = obj2.watt_hours;
				}
			}
		}

		adapter.log.debug("everhour - uebergabe_power_kw: " + uebergabe_power_kw);
		adapter.log.debug("everhour - uebergabe_power_kwh: " + uebergabe_power_kwh);

		let watts1 = uebergabe_power_kw[1]; let	watts2 = uebergabe_power_kw[2]; let	watts3 = uebergabe_power_kw[3]; let	watts4 = uebergabe_power_kw[4]; let	watts5 = uebergabe_power_kw[5];

		let watts1_data;	let watts2_data;	let watts3_data;	let watts4_data;	let watts5_data;

		let pos1;	let pos2;	let pos3;	let pos4;

		for(let time in watts1) {

			let today = new Date();
			let month = today.getUTCMonth() +1;
			let year = today.getUTCFullYear();
			let day = today.getUTCDate();
			month = (month <= 9 ? '0' + month : month);
			day = (day <= 9 ? '0'+ day : day);
			let pos5 = time.indexOf(year+'-'+ month  + '-'+day);

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

				adapter.log.debug("pos1: "+ pos1 + " - pos2: "+ pos2 + "- pos3: " + pos3 + " - pos4: "+ pos4 + " - pos5: "+ pos5);

			if((pos1 !== -1 || pos2 !== -1 || pos3 !== -1 || pos4 !== -1) && (pos5 !== -1)  )  {

				let time2 =time.substr(-8,8);

				//adapter.log.debug("time2"+time2);
				if (plant_d_everyhour[0] === true && plant_active[0] === true){
					watts1_data =  JSON.parse(watts1[time]);
					watts1_data = watts1_data /1000;
					await adapter.setStateAsync('1.everyhour_kw.' + time2,{val: Number(watts1_data), ack:true});
					adapter.log.debug("watts1_data"+ watts1_data);
				}
				if (plant_d_everyhour[1] === true && plant_active[1] === true){
					watts2_data =  JSON.parse(watts2[time]);
					watts2_data = watts2_data /1000;
					await adapter.setStateAsync('2.everyhour_kw.' + time2,{val: Number(watts2_data), ack:true});
					adapter.log.debug("watts2_data"+ watts2_data);
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

					if(watts1_data == null){watts1_data = 0}
					if(watts2_data == null){watts2_data = 0}
					if(watts3_data == null){watts3_data = 0}
					if(watts4_data == null){watts4_data = 0}
					if(watts5_data == null){watts5_data = 0}

					let a = watts1_data + watts2_data + watts3_data + watts4_data + watts5_data;
					adapter.log.debug("everyhour_summary" + a);

					await adapter.setStateAsync('summary.everyhour_kw.' + time2, {val: Number(a), ack: true});
				}
			}
		}
	} catch (e) {

	}

}