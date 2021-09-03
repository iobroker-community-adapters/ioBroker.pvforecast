
/**
 *
 * pvforecast adapter
 *
 *
 */

'use strict';

// you hav	e to require the utils module and call adapter function
const schedule = require('node-schedule');
const utils =    require('@iobroker/adapter-core');

const request = require('request')
const axios = require('axios'); 
var adapter = new utils.Adapter('pvforecast');

let thisUrl ='';
var pvname = '';


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
		
    adapter.log.debug('    ');	   
   	adapter.log.debug('Längengrad: ' + adapter.config.longitude);
	adapter.log.debug('Breitengrad: ' + adapter.config.latitude);
	adapter.log.debug('Neigung: ' + adapter.config.tilt);
	adapter.log.debug('Azimuth: ' + adapter.config.Azimuth);
	adapter.log.debug('Plant-performance: ' + adapter.config.Plantp);
	adapter.log.debug('Link: ' + adapter.config.linkdata);
    adapter.log.debug('plant name: ' + adapter.config.pvname);
    adapter.log.debug('Account: ' + adapter.config.account);
    adapter.log.debug('    ');	
	
	//Variablen zur Übergabe und Prüfen der Einträge im Admin
	var längengrad = adapter.config.longitude;
	var breitengrad  = adapter.config.latitude;
	var Neigung = adapter.config.tilt;
	var Azimuth = adapter.config.Azimuth;	
	var Anlagenleistung = adapter.config.Plantp;	
	let url2 = adapter.config.linkdata;	
	var checkbox_setting = adapter.config.option7;	
	var apikey = adapter.config.APIK;
	var account = adapter.config.account;
	var settinggpsiobroker = adapter.config.settingsiobroker;
    pvname = adapter.config.pvname;
	
	
	adapter.log.debug("setting-gps-iobroker:  " + settinggpsiobroker);
	if (settinggpsiobroker  == true){
		 adapter.getForeignObject("system.config", 
        (err, state) => {
            if (err) { 
				adapter.log.error(err);
            } else {
              	längengrad = state.common.longitude;
				breitengrad = state.common.latitude;
				
				//var längengrad_korrektur = längengrad.replace(/[^\.^,\d]/g, '') ; //Nur Zahlen und Dez-Zeichen
				//längengrad_korrektur       = längengrad_korrektur.replace(/[,]/g, '.') ; // "," ersetzen zu "."
				
				//var breitengrad_korrektur = breitengrad.replace(/[^\.^,\d]/g, '') ; //Nur Zahlen und Dez-Zeichen
				//breitengrad_korrektur       = breitengrad_korrektur.replace(/[,]/g, '.') ; // "," ersetzen zu "."
								
				adapter.config.longitude = längengrad_;
				adapter.config.latitude = breitengrad;

				adapter.log.debug("get System longitude  " + längengrad + ' & ' +" latitude " + breitengrad);

            }
        });
};
	
    if (url2 == ""){
		adapter.log.error('Please insert https://api.forecast.solar in the link field ');			
	} else {
	/*
	https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
	https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec/:az/:kwp 
	https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec1/:az1/:kwp1/:dec2/:az2/:kwp2/:dec3/:az3/:kwp3
	https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
	*/

		if (account == 'account-public') {
			adapter.log.debug('Account public gewählt');
			var var1 = url2 + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
		} else if ( account == 'account-personal') {
			adapter.log.debug('Account Personal gewählt');
			var var1 = url2 + "/" + apikey + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;				
		} else if ( account == 'account-professional') {
			adapter.log.debug('Account Professional gewählt');
			var var1 = url2 + "/" + apikey + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;				
		};
		adapter.log.debug('Link: ' + var1);
		thisUrl = var1;
		getPV();

	};	//if else beenden
}


async function getPV () {
	adapter.log.info('ThisUrl '+thisUrl);
	if (thisUrl) {
	await axios
	.get(thisUrl)
    .then (async function(response) {
		adapter.log.debug('axios done');					
			
		let res = response.data.result;
		adapter.log.debug('Json axios '+JSON.stringify(response.data.result));

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

					let tage = dd;
					let jahr_a = yy;

					
					
					if (mm == 1 || mm == 3 || mm == 5 || mm == 7 || mm == 8 || mm == 10 || mm == 12) {
						tage == 31;
					}
					else if (mm ==4 || mm== 6 || mm== 9){
						tage = 30;
					} 
					else {
						if (jahr_a%4 == 0){
							tage = 29;
						}
						else {
							tage = 28
						};
					}; 

                    log(tage);
					log(dd);
					if (dd < tage ){
						dd = dd +1
						var data_tomorrow =  date.getFullYear() + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd   <= 9 ? '0' + dd : dd);						
					}else if (dd >= tage -1){
						var y = new Date().getFullYear()
						var m = new Date().getMonth()
						var f= new Date(y, m+1, 1);
						
						var date = new Date(f);
						var dd2 = date.getDate()
						var mm2 = (date.getMonth() + 1)
						
						var data_tomorrow =  date.getFullYear() + '-' + (mm2 <= 9 ? '0' + mm2 : mm2 ) + '-' +  (dd2   <= 9 ? '0' + dd2 : dd2);
					};
					
	
                    log(data_tomorrow);		
					
					
					
					adapter.log.debug(data_today + ' ' + uhrzeit);
					adapter.log.debug("date_tomorrow"+data_tomorrow );					
					
					
					
					
					
					
		let wattstunden_tag = res.watt_hours_day[data_today];
		let wattstunden_tag_tomorrow = res.watt_hours_day[data_tomorrow];
		await adapter.setStateAsync('object',{val:JSON.stringify(response.data), ack:true});

		
		// conversion  from Wh to kWh
		wattstunden_tag = wattstunden_tag / 1000;
        wattstunden_tag_tomorrow = wattstunden_tag_tomorrow / 1000;
		
		// write value to datapoints
		adapter.setState('power_day_kWh',{val:wattstunden_tag, ack:true});
		adapter.setState('power_day_tomorrow_kWh',{val:wattstunden_tag_tomorrow, ack:true});
		adapter.setState('plantname',{val:pvname, ack:true});
		adapter.setState('lastUpdated_object',{val:datetime, ack:true});
		
			
			
		let watts = res.watts;
	
		//jsongraph
		let table = [];

		for(let time in watts) {
		   let entry = {};
			entry.Uhrzeit = time;
			entry.Leistung = watts[time];
			table.push(entry);
		}  
		adapter.setState('JSONTable',{val:JSON.stringify(table), ack:true}); 
		// GraphTable
		let graphTimeData = [];

		for(let time in watts) {
			let graphEntry ={};
			graphEntry.t = Date.parse(time);
			graphEntry.y = watts[time];
			graphTimeData.push(graphEntry);
		} 

		var graph = {};
		var graphData ={};
		var graphAllData = [];
		graphData.data = graphTimeData;
		graphAllData.push(graphData);
		graph.graphs=graphAllData;
		adapter.setState('JSONGraph',{val:JSON.stringify(graph), ack:true});  


    })
    .catch(function(error) {
		adapter.log.error('Axios Error '+ error);
    }); 
	}
}


const calc = schedule.scheduleJob('datenübertragen', '1 4 * * *', async function () {
	adapter.log.debug('1 4 * * *');
	await getPV (); 
});


// evaluate data from json to data point every minute 
const calc2 = schedule.scheduleJob('datenauswerten', '* * * * *', async function () {
	//if (json_geschrieben == '1') {
		adapter.getState('object', (err, state) => {
				
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
					adapter.log.debug(datum + ' ' + uhrzeit);
					var datetime1 = datum + ' ' + uhrzeit;
					
					//result Information
					var obj = JSON.parse(state.val).result;
					let watt1 = obj.watts[datum + ' ' +  uhrzeit  + ':00'];
					let watth = obj.watt_hours[datum + ' ' +  uhrzeit  + ':00'];
					
					if ( watt1 >=  0) {
						
					// conversion  from Wh to kWh

					watt1 = watt1 / 1000;
					watth = watth / 1000;
								
					adapter.log.debug('power_kW: ' + watt1);
					adapter.log.debug('power_kWh: ' + watth);
					
					adapter.setState('power_kW',{val:watt1, ack:true});
					adapter.setState('power_kWh',{val:watth, ack:true});

					var obj5 = JSON.parse(state.val).message;
					let type1 = obj5.type;
					adapter.log.debug('transfer: '  + type1);
					let place = obj5.info.place;
					adapter.log.debug('place: '  + place);	
					adapter.setState('lastUpdated_data',{val:datetime1, ack:true});
					adapter.setState('transfer',{val:type1, ack:true});
					adapter.setState('place',{val:place, ack:true});
					};	

				};
		});
	//};	
});