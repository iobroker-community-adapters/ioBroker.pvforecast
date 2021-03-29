
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
 
var adapter = new utils.Adapter('pvforecast');

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
	   
	    clearTimeout(timer);	
		schedule.cancelJob('datenübertragen');
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

   	adapter.log.info('Eingaben Admin:');
   	adapter.log.info('Längengrad: ' + adapter.config.longitude);
	adapter.log.info('Breitengrad: ' + adapter.config.latitude);
	adapter.log.info('Neigung: ' + adapter.config.option3);
	adapter.log.info('Azimuth: ' + adapter.config.option4);
	adapter.log.info('Anlagenleistung: ' + adapter.config.option5);
	adapter.log.info('Link: ' + adapter.config.option6);
    adapter.log.info('Account: ' + account);
    adapter.log.info('    ');	
	
	//Variablen zur Übergabe und Prüfen der Einträge im Admin
	var url = adapter.config.option6;
	var längengrad = adapter.config.longitude;
	var breitengrad  = adapter.config.latitude;
	var Neigung = adapter.config.option3;
	var Azimuth = adapter.config.option4;	
	var Anlagenleistung = adapter.config.option5;	
	var url2 = adapter.config.option6;	
	var checkbox_setting = adapter.config.option7;	
	var apikey = adapter.config.option8;
	var account = adapter.config.account;
	var settinggpsiobroker = adapter.config.settingsiobroker;

	adapter.log.info("setting-gps-iobroker:  " + settinggpsiobroker);
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

				adapter.log.info("get System longitude  " + längengrad + ' & ' +" latitude " + breitengrad);

            }
        });
 
	
};
	
    if (url2 == ""){
		adapter.log.info('Bitte tragen Sie einen Link ein');			
	} else {
	
		//var var1 = url2 + "/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
		//adapter.log.info(account);
		if (account == 'account-public') {
			//adapter.log.info('Account Public gewählt');	
			var var1 = url2 + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
		} else if (account == 'account-proffesional') {
			adapter.log.info('Account Proffesional gewählt');
			var var1 = url2 + "/" + apikey + "/estimate/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;				
		};

		adapter.log.info('request url: '+var1);
		request(
			{
				url: var1,	
				method: 'GET',
				headers:{
					'User-Agent': 'request' 
				}				
			},
		
			function(error, response, body) {

				if (!error && response.statusCode == 200) {
					adapter.log.info('request done');					
					
					let res = JSON.parse(body).result; 
					
					var d = new Date();
					var dd = d.getUTCDate();
					var mm = d.getUTCMonth() + 1;
					var yy= d.getUTCFullYear();
					
					var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
	

					let wattstunden_tag = res.watt_hours_day[date_1];
	/*			
	
					adapter.setObjectNotExists('json', {
						type: 'state',
						common: {
							name: 'json', 
							type: 'state', //json
							role: 'json'
							},
							native: {}
					});
					
					adapter.setObjectNotExists('Leistung Wh pro Tag', {
						type: 'state',
						common: {
							name: 'Leistung Wh pro Tag', 
							type: 'number',
							role: 'value'
							},
							native: {}
					});
					
					adapter.setObjectNotExists('letzte Aktualisierung', {
						type: 'state',
						common: {
							name: 'letzte Aktualisierung', 
							type: 'string',
							role: 'value.time'
							},
							native: {}
					});
	*/				
					adapter.setState('json',{val:body, ack:true});
					adapter.setState('Leistung_Wh_pro_Tag',{val:wattstunden_tag, ack:true});
					adapter.setState('letzte_Aktualisierung',{val:date_1, ack:true});

	
				} else {
				    adapter.log.info('request error ' + error+' Status Code '+response.statusCode);
				};//if error
			} // function
		); //request	   
	};	//if else beenden
}


const calc = schedule.scheduleJob('datenübertragen', '*/1 * * * *', function () {
	adapter.log.info('*/1 * * * * *');
  
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
					adapter.log.info(datum + ' ' + uhrzeit);
					
					
					var obj = JSON.parse(state.val).result;
/*
					adapter.setObjectNotExists('Leistung W', {
						type: 'state',
						common: {
							name: 'Leistung W', 
							type: 'number',
							role: 'value'
							},
							native: {}
					});

					adapter.setObjectNotExists('Leistung Wh', {
						type: 'state',
						common: {
							name: 'Leistung Wh', 
							type: 'number',
							role: 'value'
							},
							native: {}
					});		

	*/				
					//result Information
					var obj = JSON.parse(state.val).result;
					let watt1 = obj.watts[datum + ' ' +  uhrzeit  + ':00'];
					let watth = obj.watt_hours[datum + ' ' +  uhrzeit  + ':00'];
					
					if (  watt1 >= 0) {
						adapter.log.info('watt: ' + watt1);
						adapter.log.info('wattstunden: ' + watth);
						adapter.setState('Leistung_W',{val:watt1, ack:true});
						adapter.setState('Leistung_Wh',{val:watth, ack:true});
					};	

/*
					adapter.setObjectNotExists('Ort', {
						type: 'state',
						common: {
							name: 'ort', 
							type: 'string',
							role: 'value'
							},
							native: {}
					});

					adapter.setObjectNotExists('Übermittlung der Daten', {
						type: 'state',
						common: {
							name: 'Übermittlung der Daten', 
							type: 'string',
							role: 'value'
							},
							native: {}
					});	
*/					
					//Message Information
					var obj5 = JSON.parse(state.val).message;

					let type1 = obj5.type;
					adapter.log.info('Übertragung: '  + type1);

					let place = obj5.info.place;
					adapter.log.info('Ort: '  + place);	
					
					adapter.setState('Übermittlung_der_Daten',{val:type1, ack:true});
					adapter.setState('Ort',{val:place, ack:true});					   					
		
		};
    });
	
 
});
