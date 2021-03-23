
/**
 *
 * template adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "template",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js template Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@template.com>"
 *          ]
 *          "desc":         "template adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "materialize":  true,                       // support of admin3
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42,
 *          "mySelect": "auto"
 *      }
 *  }
 *
 */

/* jshint -W097 */
// jshint strict:false
/*jslint node: true */
'use strict';

// you hav	e to require the utils module and call adapter function
const schedule = require('node-schedule');
const utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
//const utils =    require('@iobroker/adapter-core');
//const buttonAction = require('./lib/buttonAction.js');                  // buttonAction

   const request = require('request')
  // import * as request from "request";

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = new utils.Adapter('template');

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

// is called if a subscribed object changes
//adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
//    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
//});

// is called if a subscribed state changes
//adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
//    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
//    if (state && !state.ack) {
//        adapter.log.info('ack is not set!');
//    }
//});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
/*adapter.on('message', function (obj) {
    if (typeof obj === 'object' && obj.message) {
        if (obj.command === 'send') {
            // e.g. send email or pushover or whatever
            console.log('send command');

            // Send response in callback if required
            if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        }
    }
});*/

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
   main();
});



function main() {
	
   // adapter.config
   
   
   	adapter.log.info('Eingaben Admin:');
   	adapter.log.info('Längengrad: ' + adapter.config.option1);
	adapter.log.info('Breitengrad: ' + adapter.config.option2);
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
	

	
	if (längengrad == ""){
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
			var var1 = url2 + "/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;
			adapter.log.info(var1);
		} else if (account == 'account-poffesional') {
			adapter.log.info('Account Proffesional gewählt');
			var var1 = url2 + "/" + apikey + "/" + breitengrad + "/" + längengrad + "/" + Neigung + "/" + Azimuth + "/" + Anlagenleistung;		
           adapter.log.info(var1);			
		};

	 
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
					//adapter.log.info(date_1);

					let wattstunden = res.watt_hours_day[date_1];
				
	
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
					
					adapter.setState('json',{val:body, ack:true});
					adapter.setState('Leistung Wh pro Tag',{val:wattstunden, ack:true});

	
				} else {
				    adapter.log.info('request error' + error);
	//				adapter.log.info(error);
				};//if error

			} // function
		); //request	   
	};	//if else beenden


 //   setTimeout(function () {
  //      shutterDriveCalc();
  //      createShutter();
  //  }, 1000);


}


const calc = schedule.scheduleJob('datenübertragen', '*/1 * * * *', function () {
	adapter.log.info('*/1 * * * * *');
  
	adapter.getState('json', (err, state) => {
	
		if (err) {
			adapter.log.error('schedule datenabfrage: ' + err);
		} else {

         	//adapter.log.info('schedule datenabfrage: ' + state.val);
            // adapter.log.info('schedule datenabfrage: ' +'Typ body: ' + typeof state); 

					var d = new Date();
					var dd = d.getUTCDate();
					var mm = d.getUTCMonth() + 1;
					var yy= d.getUTCFullYear();
					var h = d.getHours();
					var m = d.getMinutes();
					var uhrzeit =  (h <= 9 ? '0' + h : h ) + ':' +  (m <= 9 ? '0' + m : m);
					var date_1 = yy + '-' + (mm <= 9 ? '0' + mm : mm ) + '-' +  (dd <= 9 ? '0' + dd : dd);
					adapter.log.info(date_1 + ' ' + uhrzeit);
					
					
					var obj = JSON.parse(state.val).result;

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
					
					var obj = JSON.parse(state.val).result;
					let watt1 = obj.watts[date_1 + ' ' +  uhrzeit  + ':00'];
					let watth = obj.watt_hours[date_1 + ' ' +  uhrzeit  + ':00'];
						

					if (  watt1 >= 0) {
						adapter.log.info('watt: ' + watt1);
						adapter.log.info('wattstunden: ' + watth);
						adapter.setState('Leistung W',{val:watt1, ack:true});
						adapter.setState('Leistung Wh',{val:watth, ack:true});
					};	

					
	
					var obj2 = obj.watt_hours_day[date_1];
					adapter.log.info('Wattstunden pro Tag: ' + obj2);	
					
					
					
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
					
	
					var obj5 = JSON.parse(state.val).message;

					let type1 = obj5.type;
					adapter.log.info('type'  + type1);

					let place = obj5.info.place;
					adapter.log.info('place'  + place);	
					
					adapter.setState('Übermittlung der Daten',{val:type1, ack:true});
					adapter.setState('Ort',{val:place, ack:true});					   					
		
		};
    });
	
 
});
