
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
var json_geschrieben = '';


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
	
   // adapter.config

   	adapter.log.debug('Eingaben Admin:');
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
				adapter.config.longitude = state.common.longitude;
				adapter.config.latitude = state.common.latitude;

				adapter.log.debug("get System longitude  " + längengrad + ' & ' +" latitude " + breitengrad);

            }
        });
};
	
    if (url2 == ""){
		adapter.log.error('Bitte tragen Sie einen Link ein');			
	} else {
	/*
	https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp
	https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec/:az/:kwp 
	https://api.forecast.solar/:apikey/estimate/:lat/:lon/:dec1/:az1/:kwp1/:dec2/:az2/:kwp2/:dec3/:az3/:kwp3
	https://api.forecast.solar/estimate/:lat/:lon/:dec/:az/:kwp

	*/
		//var var1 = url2 + "/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
		//adapter.log.debug(account);
		if (account == 'account-public') {
			//adapter.log.debug('Account Public gewählt');	
			var var1 = url2 + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
		} else if (account == 'account-proffesional') {
			adapter.log.debug('Account Proffesional gewählt');
			var var1 = url2 + "/" + apikey + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;	
		/*} else if (account == 'account-proffesional') {
			adapter.log.debug('Account Proffesional gewählt');
			var var1 = url2 + "/" + apikey + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;	
			*/				
		};
		
		thisUrl = var1;
		getPV();

	};	//if else beenden
}


async function getPV () {
	adapter.log.info('ThisUrl '+thisUrl);
	if (thisURL) {
	await axios
	.get(thisUrl)
    .then (async function(response) {
		adapter.log.info('axios done');					
			
		let res = response.data.result;
		adapter.log.debug('Json axios '+JSON.stringify(response.data.result));
					var d = new Date();
					var dd = d.getUTCDate();
					var mm = d.getUTCMonth() + 1;
					var yy= d.getUTCFullYear();
					var h = d.getHours();
					var m = d.getMinutes();
					var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
					var datum = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
					adapter.log.debug(datum + ' ' + uhrzeit);
					var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
					var datetime =datum + ' ' + uhrzeit

		let wattstunden_tag = res.watt_hours_day[datum];

		await adapter.setStateAsync('json',{val:JSON.stringify(response.data), ack:true});
		json_geschrieben = '1';
		adapter.setState('Leistung_Wh_pro_Tag',{val:wattstunden_tag, ack:true});
		adapter.setState('Anlagenname',{val:pvname, ack:true});
		adapter.setState('letzte_Aktualisierung',{val:datetime, ack:true});
    })
    .catch(function(error) {
		adapter.log.error('Axios Error '+ error);
    }); 
	}
}


const calc = schedule.scheduleJob('datenübertragen', '0 0 * * *', async function () {
	//adapter.log.debug('0 0 * * *');
	await getPV (); 
});


// evaluate data from json to data point every minute 
const calc2 = schedule.scheduleJob('datenauswerten', '* * * * *', async function () {
	if (json_geschrieben == '1') {
		adapter.getState('json', (err, state) => {
				
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

					//result Information
					var obj = JSON.parse(state.val).result;
					let watt1 = obj.watts[datum + ' ' +  uhrzeit  + ':00'];
					let watth = obj.watt_hours[datum + ' ' +  uhrzeit  + ':00'];
					
					if (  watt1 >= 0) {
						adapter.log.debug('watt: ' + watt1);
						adapter.log.debug('wattstunden: ' + watth);
						adapter.setState('Leistung_W',{val:watt1, ack:true});
						adapter.setState('Leistung_Wh',{val:watth, ack:true});
					};	

					var obj5 = JSON.parse(state.val).message;

					let type1 = obj5.type;
					adapter.log.debug('Übertragung: '  + type1);
					let place = obj5.info.place;
					adapter.log.debug('Ort: '  + place);	
					
					adapter.setState('Übermittlung_der_Daten',{val:type1, ack:true});
					adapter.setState('Ort',{val:place, ack:true});		
				};
		});
	};	
});