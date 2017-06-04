
/* jslint node: true, laxcomma: true, esversion: 6 */

var util = require('util');
var noble = require('noble');

 "use strict";
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("BLEDoorOpener", "BLEDoorOpener", DoorAccessory);
};


/**
 * DoorAccessory
 */
function DoorAccessory(log,config) {
    this.log = log;

    this.name = config['name'];

    this.service = new Service.GarageDoorOpener(config['name'], config['name']);
    this.setupGarageDoorOpenerService(this.service);

    this.informationService = new Service.AccessoryInformation();
    this.informationService.setCharacteristic(Characteristic.Manufacturer, "EasyLiFT");
    this.informationService.setCharacteristic(Characteristic.Model, "BluetoothReciever");

        noble.on('discover', (peripheral) => {
         log("Discovered " +peripheral.advertisement.localName+ ": " + peripheral.uuid );
          if(peripheral.uuid == config['uuid'])
          {
            thatService = this.service;
           peripheral.connect((error)  => {
             log('connected to peripheral: ' + peripheral.advertisement.localName);
             peripheral.discoverServices(['1802'], (error, services)  =>{
               for (var i in services) {
                deviceInformationService =services[i];
                deviceInformationService.discoverCharacteristics(['2a06'], function(error, characteristics) {
                  for (var i in characteristics) {
                    log('  ' + i + " Service UUDI:"+characteristics[i]._serviceUuid+ ' uuid: ' + characteristics[i].uuid +" name:"+characteristics[i].name + " ServiceProperties:"+characteristics[i].properties);
                     
                  }
                  var alertLevelCharacteristic = characteristics[0];
                    log("The door just triggered");
                    openCommand = new Buffer([0x00,0x80,0x54,0x03,0xb3,0xf6,0x35,0x84]);
                    //openCommand = new Buffer([0x00,]); //No-Op
                    alertLevelCharacteristic.write(openCommand, true, (error) => {
                      log('Door Opening.');
                      setTimeout(() =>
                        {
                          log('Peripheral disconecting '  +peripheral.advertisement.localName);
                          var tds = thatService.getCharacteristic(Characteristic.TargetDoorState);
                          thatService.setCharacteristic(Characteristic.CurrentDoorState, 
                            tds.value);
                          peripheral.disconnect();
                          noble.stopScanning();
                        },14000);
                    });

                 });
               }
             });
           });
          }
    });
}

 DoorAccessory.prototype.setupGarageDoorOpenerService = function(service) {
    //initial state door is closed
    this.service.setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
    this.service.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);

    service.getCharacteristic(Characteristic.TargetDoorState)
      .on('get', (callback) => {
        var tds = service.getCharacteristic(Characteristic.TargetDoorState).value;
        if (tds === Characteristic.TargetDoorState.OPEN &&
          (((new Date()) - this.lastOpened) >= (this.closeAfter * 1000))) {
          this.log('Setting TargetDoorState to CLOSED');
          callback(null, Characteristic.TargetDoorState.CLOSED);
        } else {
          callback(null, tds);
        }
      })
      .on('set', (value, callback) => {
        if (value === Characteristic.TargetDoorState.OPEN || value === Characteristic.TargetDoorState.CLOSED) {
          this.lastOpened = new Date();
          switch (service.getCharacteristic(Characteristic.CurrentDoorState).value) {
            case Characteristic.CurrentDoorState.CLOSED:
            case Characteristic.CurrentDoorState.CLOSING:
            case Characteristic.CurrentDoorState.OPEN:
              this.openDoor(callback);
              break;
            default:
              callback();
          }
        } else {
          callback();
        }
      });
  }

DoorAccessory.prototype.getServices = function() {
    return [this.informationService, this.service];
};



DoorAccessory.prototype.openDoor = function(callback) {
    this.log("Opening Garage Door ");
    noble.startScanning([] ,false);
    callback(null, true);
}






