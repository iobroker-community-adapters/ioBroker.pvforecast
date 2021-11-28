
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
var watts_tomorrow_plants1 = 0; var watts_tomorrow_plants2 = 0; var watts_tomorrow_plants3 = 0; var watts_tomorrow_plants4 = 0; var watts_tomorrow_plants5 = 0;
var watts_tag_plants1 = 0; var watts_tag_plants2 = 0; var watts_tag_plants3 = 0; var watts_tag_plants4 = 0; var watts_tag_plants5 = 0;

let power_kw1 = 0; let power_kw2 = 0; let power_kw3 = 0; let power_kw4 = 0; let power_kw5 = 0;
let power_kwh1 = 0; let power_kwh2 = 0; let power_kwh3 = 0; let power_kwh4 = 0; let power_kwh5 = 0;
let power_kw = [power_kw1,power_kw2,power_kw3,power_kw4,power_kw5]
let power_kwh = [power_kwh1,power_kwh2,power_kwh3,power_kwh4,power_kwh5]

var urls = [options1,options2,options3,options4,options5]

var watts_tomorrow_plants = [watts_tomorrow_plants1,watts_tomorrow_plants2,watts_tomorrow_plants3,watts_tomorrow_plants4,watts_tomorrow_plants5]
var watts_tag_plants = [watts_tag_plants1,watts_tag_plants2,watts_tag_plants3,watts_tag_plants4,watts_tag_plants5]



// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
	   
	    clearTimeout(timer);	
		schedule.cancelJob('datenübertragen');
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

function main() {
		
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
	
   	adapter.log.debug('Längengrad: ' + lon + '	Breitengrad: ' + lat + '	Link: ' + forcastUrl + '	Link: ' + forcastUrl); //'	Account: ' + account );

	adapter.log.debug('Plant1 -> tilt1: ' + Neigung1 + ' Azimuth1: ' + Azimuth1 + ' Plant-performance1: ' + Anlagenleistung1 + ' plant name1: ' + pvname1);	
	adapter.log.debug('Plant2 -> tilt2: ' + Neigung2 + ' Azimuth2: ' + Azimuth2 + ' Plant-performance2: ' + Anlagenleistung2 + ' plant name2: ' + pvname2);
	adapter.log.debug('Plant3 -> tilt3: ' + Neigung3 + ' Azimuth3: ' + Azimuth3 + ' Plant-performance3: ' + Anlagenleistung3 + ' plant name3: ' + pvname3);
	adapter.log.debug('Plant4 -> tilt4: ' + Neigung4 + ' Azimuth4: ' + Azimuth4 + ' Plant-performance4: ' + Anlagenleistung4 + ' plant name4: ' + pvname4);
	adapter.log.debug('Plant5 -> tilt5: ' + Neigung5 + ' Azimuth5: ' + Azimuth5 + ' Plant-performance5: ' + Anlagenleistung5 + ' plant name5: ' + pvname5);


	let plant2_active2 = adapter.config.plant2_activ;
	let plant3_active3 = adapter.config.plant3_activ;
	let plant4_active4 = adapter.config.plant4_activ;
	let plant5_active5 = adapter.config.plant5_activ;


//get system lon and lat
	/*
	if (settinggpsiobroker  == true){
		 adapter.getForeignObject("system.config", 
        (err, state) => {
            if (err) { 
				adapter.log.error(err);
            } else {
              	lon = state.common.longitude;
				lat = state.common.latitude;
		
				adapter.config.longitude = lon;
				adapter.config.latitude = lat;

				adapter.log.debug("get System longitude  " + lon + ' & ' +" latitude " + lat);
            }
        });
	};
	*/
		
	const declination = [Neigung1,Neigung2,Neigung3,Neigung4,Neigung5];
	const azimuth = [Azimuth1,Azimuth2,Azimuth3, Azimuth4, Azimuth5];
	const kwp = [Anlagenleistung1,Anlagenleistung2,Anlagenleistung3,Anlagenleistung4,Anlagenleistung5];

	if(apikey !== ''){ apikey = '/' + apikey}

	urls[0]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[0]+'/'+azimuth[0]+'/'+kwp[0];
	if (plant2_active2){urls[1]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[1]+'/'+azimuth[1]+'/'+kwp[1]}
	if (plant3_active3){urls[2]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[2]+'/'+azimuth[2]+'/'+kwp[2]}
	if (plant4_active4){urls[3]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[3]+'/'+azimuth[3]+'/'+kwp[3]}
	if (plant5_active5){urls[4]  = forcastUrl+apikey+'/estimate/'+lat+'/'+lon+'/'+declination[4]+'/'+azimuth[4]+'/'+kwp[4]}
	 
	 
	adapter.log.debug('urls: ' + urls[0]);
	adapter.log.debug('urls: ' + urls[1]);
	adapter.log.debug('urls: ' + urls[2]);
	adapter.log.debug('urls: ' + urls[3]);
	adapter.log.debug('urls: ' + urls[4]);

	getPV();
	create_delete_state();
	gethistory;
}
	
async function getPV () {

	let url_read_index = 1;
	
	//Data from settings user interface
	let legend1 = adapter.config.legend1;
	let graphcolor1 = adapter.config.graphcolor1;
	let datalabelColor1 = adapter.config.datalabelColor1;

	let legend2 = adapter.config.legend2;
	let graphcolor2 = adapter.config.graphcolor2;
	let datalabelColor2 = adapter.config.datalabelColor2; let plant2_activ2 = adapter.config.plant2_activ;

	let legend3 = adapter.config.legend3;
	let graphcolor3 = adapter.config.graphcolor3;
	let datalabelColor3 = adapter.config.datalabelColor3; let plant3_activ3 = adapter.config.plant3_activ;

	let legend4 = adapter.config.legend4;
	let graphcolor4 = adapter.config.graphcolor4;
	let datalabelColor4 = adapter.config.datalabelColor4; let plant4_activ4 = adapter.config.plant4_activ;

	let legend5 = adapter.config.legend5;
	let graphcolor5 = adapter.config.graphcolor5;
	let datalabelColor5 = adapter.config.datalabelColor5; let plant5_activ5 = adapter.config.plant5_activ;

	let axisy_step = adapter.config.axisy_step1;
	let datalabel_rotation = adapter.config.datalabel_rotation1;
	let pvname = [pvname1,pvname2,pvname3,pvname4,pvname5];

	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_activ;
	let plant3_active3 = adapter.config.plant3_activ;
	let plant4_active4 = adapter.config.plant4_activ;
	let plant5_active5 = adapter.config.plant5_activ;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

	//user interface data in array

	const legendTest = [legend1,legend2,legend3,legend4,legend5]; // z.b. west
	const graphColor = [graphcolor1,graphcolor2,graphcolor3,graphcolor4,graphcolor5];  // z.b. blue
	const datalabelColor = [datalabelColor1,datalabelColor2,datalabelColor3,datalabelColor4,datalabelColor5]; // z.b. lightblue

	adapter.log.debug('getpv ');
	
	//date from today and tomorrow		
	var d = new Date();
	var dd = d.getUTCDate();
	var mm = d.getUTCMonth() + 1;
	var yy= d.getUTCFullYear();
	var h = d.getHours();
	var m = d.getMinutes();
	var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
	var data_today = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

	var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd); //aktueller tag

	var datetime =data_today + ' ' + uhrzeit;



//heute = heute.getDate();
	let vorhersage_d_tag1;
	let vorhersage_d_tag2;
	let vorhersage_d_tag3;
	let vorhersage_d_tag4;
	let vorhersage_d_tag5;
	let vorhersage_d_tag6;
	let vorhersage_d_tag7;
	let vorhersage_datum = [vorhersage_d_tag1,vorhersage_d_tag2,vorhersage_d_tag3,vorhersage_d_tag4,vorhersage_d_tag5,vorhersage_d_tag6,vorhersage_d_tag7]
	let heute = new Date();
	let morgen = new Date(heute.getTime()+(1000 * 60 * 60 * 24 * 0)); // übermorgen wäre dann am Ende eine 2 anstatt 1

	for (let i = 0; i < 8; i++) {
		let tag_übergabe = new Date(heute.getTime() + (1000 * 60 * 60 * 24 * i)); // übermorgen wäre dann am Ende eine 2 anstatt 1
		vorhersage_datum[i] = tag_übergabe.getDate();
	}

	adapter.log.debug('vorhersage_datum' + vorhersage_datum);
	var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[0] <= 9 ? '0' + vorhersage_datum[0] : vorhersage_datum[0]);
	var date_2 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[1] <= 9 ? '0' + vorhersage_datum[1] : vorhersage_datum[1]);
	var date_3 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[2] <= 9 ? '0' + vorhersage_datum[2] : vorhersage_datum[2]);
	var date_4 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[3] <= 9 ? '0' + vorhersage_datum[3] : vorhersage_datum[3]);
	var date_5 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[4] <= 9 ? '0' + vorhersage_datum[4] : vorhersage_datum[4]);
	var date_6 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[5] <= 9 ? '0' + vorhersage_datum[5] : vorhersage_datum[5]);
	var date_7 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (vorhersage_datum[6] <= 9 ? '0' + vorhersage_datum[6] : vorhersage_datum[6]);



	//data to datapoints |graph | table
	for (let url_read of urls) {
		thisUrl = url_read;

	//	adapter.log.debug('ThisUrl '+thisUrl);
		
		if (thisUrl) {
		await axios
		.get(thisUrl)
		.then (async function(response) {
			adapter.log.debug('axios done');					
				
			let res = response.data.result;
			adapter.log.debug('Json axios '+JSON.stringify(response.data.result));
		
							
			let wattstunden_tag = res.watt_hours_day[date_1];
			let wattstunden_tag_tomorrow = res.watt_hours_day[date_2];
	//		let wattstunden_tag_tomorrow = res.watt_hours_day[data_tomorrow];
	//		let wattstunden_tag_tomorrow = res.watt_hours_day[data_tomorrow];
	//		let wattstunden_tag_tomorrow = res.watt_hours_day[data_tomorrow];
	//		let wattstunden_tag_tomorrow = res.watt_hours_day[data_tomorrow];
			await adapter.setStateAsync(url_read_index + '.object',{val:JSON.stringify(response.data), ack:true});

			
			// conversion  from Wh to kWh
			wattstunden_tag = wattstunden_tag / 1000;
			watts_tag_plants[url_read_index] = wattstunden_tag
			
			wattstunden_tag_tomorrow = wattstunden_tag_tomorrow / 1000;
			watts_tomorrow_plants[url_read_index] = wattstunden_tag_tomorrow

			// write value to datapoints
			adapter.log.debug("plant_active[0] true" + plant_active[0]);
			adapter.log.debug("plant_active[1] true" + plant_active[1]);
			adapter.log.debug("plant_active[2] true" + plant_active[2]);
			adapter.log.debug("plant_active[3] true" + plant_active[3]);
			adapter.log.debug("plant_active[4] true" + plant_active[4]);

			adapter.log.debug("pvname[0]" + pvname[0]);
			adapter.log.debug("pvname[1]" + pvname[1]);
			adapter.log.debug("pvname[2]" + pvname[2]);
			adapter.log.debug("pvname[3]" + pvname[3]);
			adapter.log.debug("pvname[4]" + pvname[4]);

			adapter.log.debug("url_read_index" + url_read_index);
			adapter.setState(url_read_index + '.power_day_kWh',{val:wattstunden_tag, ack:true});
			adapter.setState(url_read_index + '.power_day_tomorrow_kWh',{val:wattstunden_tag_tomorrow, ack:true});
			adapter.setState(url_read_index + '.plantname',{val:pvname[url_read_index-1], ack:true});
			adapter.setState(url_read_index + '.lastUpdated_object',{val:datetime, ack:true});
		
			let watts = res.watts;
			
			//jsongraph
			let table = [];

			for(let time in watts) {
			   let entry = {};

				entry.Uhrzeit = time;
				entry.Leistung = watts[time];
				table.push(entry);
			}  
				
			adapter.setState(url_read_index + '.JSONTable',{val:JSON.stringify(table), ack:true}); 
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
			
			adapter.setState(url_read_index + '.JSONGraph',{val:JSON.stringify(graph), ack:true}); 			
			
		})
		.catch(function(error) {
			if (error == "Error: Request failed with status code 429"){
					adapter.log.error('too many data requests');				
			} else if (error == "Error: Request failed with status code 400"){				
					adapter.log.error('entry out of range (check the notes in settings) => check azimuth, tilt, longitude,latitude');					
			} else{
				adapter.log.error('Axios Error '+ error);		
			}
		}); 
		} 
			
		url_read_index =  url_read_index + 1;		
	}
		
	let wattstunden_tag_summary =0;
	let wattstunden_tag_tomorrow_summary =0;

	for (let i = 1; i < 6; i++) {
		wattstunden_tag_summary += watts_tag_plants[i];
	}

	for (let i = 1; i < 6; i++) {
		wattstunden_tag_tomorrow_summary += watts_tomorrow_plants[i];
	}


	adapter.log.debug("watts_tag_plants[0]" + watts_tag_plants[0]);
	adapter.log.debug("watts_tag_plants[1]" + watts_tag_plants[1]);
	adapter.log.debug("watts_tag_plants[2]" + watts_tag_plants[2]);
	adapter.log.debug("watts_tag_plants[3]" + watts_tag_plants[3]);
	adapter.log.debug("watts_tag_plants[4]" + watts_tag_plants[4]);
	adapter.log.debug("watts_tag_plants[5]" + watts_tag_plants[5]);

	adapter.log.debug("watts_tomorrow_plants[0]" + watts_tomorrow_plants[0]);
	adapter.log.debug("watts_tomorrow_plants[1]" + watts_tomorrow_plants[1]);
	adapter.log.debug("watts_tomorrow_plants[2]" + watts_tomorrow_plants[2]);
	adapter.log.debug("watts_tomorrow_plants[3]" + watts_tomorrow_plants[3]);
	adapter.log.debug("watts_tomorrow_plants[4]" + watts_tomorrow_plants[4]);
	adapter.log.debug("watts_tomorrow_plants[5]" + watts_tomorrow_plants[5]);


	adapter.log.debug('summary.power_day_kWh:' + wattstunden_tag_summary + ' summary.power_day_tomorrow_kWh: ' + wattstunden_tag_tomorrow_summary);

	adapter.setState('summary.power_day_kWh',{val:wattstunden_tag_summary, ack:true});
	adapter.setState('summary.power_day_tomorrow_kWh',{val:wattstunden_tag_tomorrow_summary, ack:true});
	
	let übergabe_power_kw1 = 0;	let übergabe_power_kw2 = 0;	let übergabe_power_kw3 = 0;	let übergabe_power_kw4 = 0;	let übergabe_power_kw5 = 0;
	let übergabe_power_kwh1 = 0;	let übergabe_power_kwh2 = 0;	let übergabe_power_kwh3 = 0;	let übergabe_power_kwh4 = 0;	let übergabe_power_kwh5 = 0;

	var übergabe_power_kw = [übergabe_power_kw1,übergabe_power_kw2,übergabe_power_kw3,übergabe_power_kw4,übergabe_power_kw5];	
	var übergabe_power_kwh = [übergabe_power_kwh1,übergabe_power_kwh2,übergabe_power_kwh3,übergabe_power_kwh4,übergabe_power_kwh5];

	for (let index = 1; index < 6; index++) {
		if (plant_active[index-1] == true){
			const stateValue = await adapter.getStateAsync(index + '.object');

				var obj2 = JSON.parse(stateValue.val).result;

				übergabe_power_kw[index] = obj2.watts;
				übergabe_power_kwh[index] = obj2.watt_hours;

				let obj5 = JSON.parse(stateValue.val).message;
				let place1 = obj5.info.place;
				let type1 = obj5.type;

				adapter.log.debug(index + '.transfer: '  + type1);
				adapter.log.debug(index + '.place: '  + place1);

				adapter.setState(index + '.transfer',{val:type1, ack:true});
				adapter.setState(index + '.place',{val:place1, ack:true});
		}
	}
	
	adapter.log.debug('vorübergabe_power_kw[0]: ' + JSON.stringify(übergabe_power_kw[0]));
	adapter.log.debug('vorübergabe_power_kw[1]: ' + JSON.stringify(übergabe_power_kw[1]));
	adapter.log.debug('vorübergabe_power_kw[2]: ' + JSON.stringify(übergabe_power_kw[2]));	
	adapter.log.debug('vorübergabe_power_kw[3]: ' + JSON.stringify(übergabe_power_kw[3]));	
	adapter.log.debug('vorübergabe_power_kw[4]: ' + JSON.stringify(übergabe_power_kw[4]));		
	
	var d = new Date();
	var dd = d.getUTCDate();
	var mm = d.getUTCMonth() + 1;
	var yy= d.getUTCFullYear();
	var h = d.getHours();
	var m = d.getMinutes();
	var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
	var data_today = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);

	var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd); //aktueller tag
	var datetime = data_today;
	
	var graph = {}; let table = []; let axisLabels = [];
		
	let watts1 = übergabe_power_kw[1]; let	watts2 = übergabe_power_kw[2]; let	watts3 = übergabe_power_kw[3]; let	watts4 = übergabe_power_kw[4]; let	watts5 = übergabe_power_kw[5];	

	for(let time in watts1) {

		let pos1 = time.indexOf(':00:00');
		let pos2 = time.indexOf(':15:00');
		let pos3 = time.indexOf(':30:00');
		let pos4 = time.indexOf(':45:00');
		  if((pos1 != -1) || (pos2 != -1)|| (pos3 != -1)|| (pos4 != -1)) {

			let entry = {};
			entry.Uhrzeit = time;
			entry.Leistung1 = watts1[time];
			if (plant2_activ2){entry.Leistung2 = watts2[time]};	
			if (plant3_activ3){entry.Leistung3 = watts3[time]};	
			if (plant4_activ4){entry.Leistung4 = watts4[time]};
			if (plant5_activ5){entry.Leistung5 = watts5[time]};			
			if (plant2_activ2 ){entry.summe = watts1[time] +  watts2[time]}	
			if (plant2_activ2  && plant3_activ3){entry.summe = watts1[time] +  watts2[time] +  watts3[time]}
			if (plant2_activ2  && plant3_activ3  &&  plant4_activ4){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time]}	
			if (plant2_activ2  && plant3_activ3  &&  plant4_activ4 &&  plant5_activ5){entry.summe = watts1[time] +  watts2[time] +  watts3[time] +  watts4[time] +  watts5[time]}					
						
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
	
	if (plant2_activ2){

		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[1],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[1],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[1],"datalabel_fontSize":10};

		graphData.data = graphTimeData2;

		graphAllData.push(graphData);
	}
	
	if (plant3_activ3){
		
		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[2],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[2],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[2],"datalabel_fontSize":10};

		graphData.data = graphTimeData3;

		graphAllData.push(graphData);		
	}
	
	if (plant4_activ4){
	
		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[3],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[3],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[3],"datalabel_fontSize":10};

		graphData.data = graphTimeData4;

		graphAllData.push(graphData);	
	}
	
	if (plant5_activ5){
		graphData = {"tooltip_AppendText": tooltip_AppendText,"legendText": legendTest[4],"yAxis_id": 1, "yAxis_step": axisy_step,"type": "bar","displayOrder": 1,"barIsStacked": true,"color":graphColor[4],"barStackId":1,"datalabel_rotation":datalabel_rotation,"datalabel_color":datalabelColor[4],"datalabel_fontSize":10};

		graphData.data = graphTimeData5;

		graphAllData.push(graphData);	
	}		

    graph.graphs=graphAllData;
	graph.axisLabels = axisLabels;

	adapter.setState('summary.JSONGraph',{val:JSON.stringify(graph), ack:true});  
	adapter.setState('summary.JSONTable',{val:JSON.stringify(table), ack:true}); 
}	

// request data from server 
const calc = schedule.scheduleJob('datenübertragen', '1 4 * * *', async function () {
	adapter.log.debug('1 4 * * *');
	await getPV (); 
});

// evaluate data from json to data point every minute 
const calc2 = schedule.scheduleJob('datenauswerten', '* * * * *', async function () {
				
	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_activ;
	let plant3_active3 = adapter.config.plant3_activ;
	let plant4_active4 = adapter.config.plant4_activ;
	let plant5_active5 = adapter.config.plant5_activ;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

	for (let index = 1; index < 6; index++) {
			
		adapter.getState(index + '.object', (err, state) => {
			if (plant_active[index-1]){

				if (err) {
					adapter.log.error('schedule datenabfrage: ' + err);
				} else {
						
					var d = new Date();
					var dd = d.getUTCDate();
					var mm = d.getUTCMonth() + 1;
					var yy= d.getUTCFullYear();
					var h = d.getHours();
					var m = d.getMinutes();
					var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
					var datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
					var datetime1 = datum + ' ' + uhrzeit;
					
					//result Information
					var obj = JSON.parse(state.val).result;
					//let watt1 = obj.watts['2021-11-26' + ' ' +  '16:00'  + ':00'];
					//let watth = obj.watt_hours['2021-11-26' + ' ' +  '16:00'  + ':00'];

					let watt1 = obj.watts[datum + ' ' +  uhrzeit  + ':00'];
					let watth = obj.watt_hours[datum + ' ' +  uhrzeit  + ':00'];

					adapter.setState(index + '.lastUpdated_data',{val:datetime1, ack:true});
					adapter.setState('summary.lastUpdated_data',{val:datetime1, ack:true});

					if ( watt1 >=  0) {

						// conversion from Wh and kWh
						watt1 = watt1 / 1000;
						watth = watth / 1000;

						power_kw[index-1] = watt1;
						power_kwh[index-1] = watth;

						adapter.log.debug(index + '.power_kW: ' + watt1);
						adapter.log.debug(index + '.power_kWh: ' + watth);

						adapter.setState(index + '.power_kW',{val:watt1, ack:true});
						adapter.setState(index + '.power_kWh',{val:watth, ack:true});

					}
				}
			}
		});
	}


	let power_kwh_summary;
	let power_kw_summary;

	//for (let i = 0; i < 3; i++)
	power_kw_summary =  power_kw[0];
	power_kw_summary =  power_kw_summary + power_kw[1];
	power_kw_summary =  power_kw_summary + power_kw[2];
	power_kw_summary =  power_kw_summary + power_kw[3];
	power_kw_summary =  power_kw_summary + power_kw[4];



	power_kwh_summary =  power_kwh[0];
	power_kwh_summary =  power_kwh_summary + power_kwh[1];
	power_kwh_summary =  power_kwh_summary + power_kwh[2];
	power_kwh_summary =  power_kwh_summary + power_kwh[3];
	power_kwh_summary =  power_kwh_summary + power_kwh[4];
	adapter.log.debug(' power_kwh'  +  power_kwh);
	//}
	/*
	for (let i = 0; i < 6; i++) {
		power_kw_summary = power_kw_summary + power_kw[i];
	}

	for (let i = 0; i < 6; i++) { //power_kwh.length
		power_kwh_summary =  power_kwh_summary + power_kwh[i];
	}
*/
	adapter.log.debug('summary.power_kw: ' + JSON.stringify(power_kw));
	adapter.log.debug('summary.power_kwh : ' + JSON.stringify(power_kwh));

	adapter.log.debug('summary.power_kW: '  + power_kw_summary);
	adapter.log.debug('summary.power_kWh: ' + power_kwh_summary);

	adapter.setState('summary.power_kW',{val:power_kw_summary, ack:true});
	adapter.setState('summary.power_kWh',{val:power_kwh_summary, ack:true});

});


// create or delete states from plants
async function create_delete_state (){
	
	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_activ;
	let plant3_active3 = adapter.config.plant3_activ;
	let plant4_active4 = adapter.config.plant4_activ;
	let plant5_active5 = adapter.config.plant5_activ;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];
	
	adapter.log.debug('plant_active'  + plant_active);
	adapter.log.debug('plant_active0' + plant_active[0]);
	adapter.log.debug('plant_active1' + plant_active[1]);
	adapter.log.debug('plant_active2' + plant_active[2]);
	adapter.log.debug('plant_active3' + plant_active[3]);
	adapter.log.debug('plant_active4' + plant_active[4]);
	
	try {
		for (let index = 1; index < 6; index++) {
			if (plant_active[index-1] == true){
				await  adapter.setObjectNotExistsAsync(index + '.power_day_kWh', {
					type: 'state',
					common: {
						name: "power_day_kWh",
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false
					},
					native: {}
				});
				
				await  adapter.setObjectNotExistsAsync(index + '.power_day_tomorrow_kWh',{				
					type: 'state',
					common: {
						name: "power_day_tomorrow_kWh",
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false
					},
					native: {}
				});
				
				await  adapter.setObjectNotExistsAsync(index + '.plantname',{			
					type: 'state',
					common: {
						name: "plantname",
						type: 'string',
						role: 'value',
						read: true,
						write: false
					},
					native: {}
				});				
				
				await  adapter.setObjectNotExistsAsync(index + '.lastUpdated_object',{				
					type: 'state',
					common: {
						name: "lastUpdated",
						type: 'string',
						role: 'value.time',
						read: true,
						write: false
					},
					native: {}
				});
							
				await  adapter.setObjectNotExistsAsync(index + '.place',{			
					type: 'state',
					common: {
						name: "place",
						type: 'string',
						role: 'value',
						read: true,
						write: false
					},
					native: {}
				});

				await  adapter.setObjectNotExistsAsync(index + '.object',{			
					type: 'state',
					common: {
						name: "object",
						type: 'json',
						role: 'value',
						read: true,
						write: false
					},
					native: {}
				});

				await  adapter.setObjectNotExistsAsync(index + '.power_kW',{				
					type: 'state',
					common: {
						name: "power_kW",
						type: 'number',
						role: 'value',
						unit: 'kW',
						read: true,
						write: false
					},
					native: {}
				});
				
				await  adapter.setObjectNotExistsAsync(index + '.lastUpdated_data',{			
					type: 'state',
					common: {
						name: "lastUpdated_data",
						type: 'string',
						role: 'value.time',
						read: true,
						write: false
					},
					native: {}
				});		

				await  adapter.setObjectNotExistsAsync(index + '.power_kWh',{				
					type: 'state',
					common: {
						name: "power_kWh",
						type: 'number',
						role: 'value',
						unit: 'kWh',
						read: true,
						write: false
					},
					native: {}
				});		

				await  adapter.setObjectNotExistsAsync(index + '.transfer',{				
					type: 'state',
					common: {
						name: "transfer",
						type: 'string',
						role: 'value',
						read: true,
						write: false
					},
					native: {}
				});	

				await  adapter.setObjectNotExistsAsync(index + '.JSONGraph',{
					type: 'state',
					common: {
						name: "JSONGraph",
						type: 'json',
						role: 'value',
						read: true,
						write: false
					},
					native: {}
				});	
				
				await  adapter.setObjectNotExistsAsync(index + '.JSONTable',{
					type: 'state',
					common: {
						name: "JSONTable",
						type: 'json',
						role: 'value',
						read: true,
						write: false
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

	/*	await  adapter.setObjectNotExistsAsync('summary.JSONTable',{
			type: 'state',
			common: {
				name: "history-Json",
				type: 'json',
				role: 'value',
				read: true,
				write: false
			},
			native: {}
		});*/

	} catch (err) {
				// ignore
	}
	
}
/*
//obejct history
async function history () {

	var json_history_power_kw = [let json_history_power_kw1,let json_history_power_kw2,let json_history_power_kw3,let json_history_power_kw4,let json_history_power_kw5];
	var json_history_power_kwh = [let json_history_power_kwh1,let json_history_power_kwh2,let json_history_power_kwh3,let json_history_power_kwh4,let json_history_power_kwh5];

	let plant1_active1 = true;
	let plant2_active2 = adapter.config.plant2_activ;
	let plant3_active3 = adapter.config.plant3_activ;
	let plant4_active4 = adapter.config.plant4_activ;
	let plant5_active5 = adapter.config.plant5_activ;
	let plant_active = [plant1_active1, plant2_active2,plant3_active3,plant4_active4,plant5_active5];

	try {
		for (let index = 1; index < 6; index++) {
			if (plant_active[index-1] == true){
				const stateValue = await adapter.getStateAsync(index + '.object');
				const obj2 = JSON.parse(stateValue.val).result;
				json_history_power_kw[index] = obj2.watts;
				json_history_power_kwh[index] = obj2.watt_hours;
				//adapter.log.debug(index + '.transfer: '  + type1);
				//adapter.log.debug(index + '.place: '  + place1)
			}
		}

		for (const value in json_history_power_kw[1]) {
			if (!json_history_power_kw[2][value]) {
				json_history_power_kw[1][value] = json_history_power_kw[2][value]
			} else {
				console.log('Eintrag existiert, mache nichts')

			}
		}

	} catch (err) {
		// ignore
	}
}
*/

