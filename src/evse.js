/* jshint node: true, esversion: 6*/

"use strict";

const divert = require("./divertmode");
const base = require("./base");

const openevse = require("openevse");
//const debug = require("debug")("openevse:evse");

module.exports = class emoncms extends base
{
  constructor(endpoint)
  {
    super();

    this._status = {
      comm_sent: 0,
      comm_success: 0,
      amp: 0,
      pilot: 0,
      temp1: 0,
      temp2: 0,
      temp3: 0,
      state: 0,
      elapsed: 0,
      wattsec: 0,
      watthour: 0,
      gfcicount: 0,
      nogndcount: 0,
      stuckcount: 0,
      divertmode: 1,
      solar: 0,
      grid_ie: 0,
      charge_rate: 0,
      divert_update: 0
    };

    this.info = {
      firmware: "-",
      protocol: "-",
      espflash: 0,
      version: "0.0.1",
      vendor: "OpenEVSE",
      model: "GoPlug Home"
    };

    this.openevse = {
      diodet: 0,
      gfcit: 0,
      groundt: 0,
      relayt: 0,
      ventt: 0,
      tempt: 0,
      service: 0,
      scale: 0,
      offset: 0,
    };

    // Time between sending a command to the OpenEVSE
    this.updateTime = 200;
    this.uploadTime = 20 * 1000;
    this.ohmTime = 60 * 1000;

    // List of items to update on calling update on startup
    this.initList = [
      function () { return this.evseConn.version(function (version, protocol) {
        this.info.firmware = version;
        this.info.protocol = protocol;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.ammeter_settings(function (scaleFactor, offset) {
        this.openevse.scale = scaleFactor;
        this.openevse.offset = offset;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.flags(function (flags) {
        this.openevse.service = flags.service;
        this.openevse.diodet = flags.diode_check;
        this.openevse.ventt = flags.vent_required;
        this.openevse.groundt = flags.ground_check;
        this.openevse.relayt = flags.stuck_relay_check;
        this.openevse.gfcit = flags.gfci_test;
        this.openevse.tempt = flags.temp_ck;
        this.divert.service = flags.service;
      }.bind(this)); }.bind(this),
    ];

    // List of items to update on calling update(). The list will be processed one item at
    // a time.
    this.updateList = [
      function () { return this.evseConn.current_capacity(function (capacity) {
        this.status = {
          pilot: capacity
        };
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.status(function (state, elapsed) {
        this.status = {
          state: state,
          elapsed: elapsed
        };
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.charging_current_voltage(function (voltage, current) {
        this.status = {
          voltage: voltage,
          amp: current
        };
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.temperatures(function (temp1, temp2, temp3) {
        this.status = {
          temp1: temp1,
          temp2: temp2,
          temp3: temp3
        };
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.energy(function (wattSeconds, whacc) {
        this.status = {
          wattsec: wattSeconds,
          watthour: whacc
        };
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.fault_counters(function (gfci_count, nognd_count, stuck_count) {
        this.status = {
          gfcicount: gfci_count,
          nogndcount: nognd_count,
          stuckcount: stuck_count
        };
      }.bind(this)); }.bind(this),
    ];


    this.evseConn = openevse.connect(endpoint);
    this.evseConn.on("state", (state) => {
      this.status = { state: state };
    });

    this.divert = new divert(this.evseConn);
    this.divert.on("mode", (mode) => {
      this.status = { divertmode: mode };
    });
    this.divert.on("charge_rate", (charge_rate) => {
      // the divert mode changed the current, update our state
      this.status = { pilot: charge_rate };

      // Bit of a hack, get new values for the live charging current.
      // This helps with testing with the Node-Red emon Pi simulator and making
      // sure we get a Grid I/E value that includes the charging current
      this.evseConn.charging_current_voltage((voltage, current) => {
        this.status = {
          voltage: voltage,
          amp: current
        };
      });
    });

    this.runList(this.initList, function () {
      this.update();
    }.bind(this));

    this.on("status", (status) => {
      if(status.state) {
        this.divert.state = status.state;
      }
    });

  }


  runList(list, always, delay = 0, count = 0)
  {
    if(count >= list.length) {
      always();
      return;
    }

    var updateFn = list[count];
    updateFn().always( () => {
      setTimeout( () => {
        this.runList(list, always.bind(this), delay, count + 1);
      }, delay);
    });
  }

  update() {
    this.runList(this.updateList, this.upload, this.updateTime);
  }

  upload()
  {
    var data = {
      amp: this._status.amp,
      wh: this._status.wattsec,
      temp1: this._status.temp1,
      temp2: this._status.temp2,
      temp3: this._status.temp3,
      pilot: this._status.pilot,
      state: this._status.state,
      freeram: this.status.free_heap,
      divertmode: this._status.divertmode
    };
    if (this._status.volt > 0) {
      data.volt = this._status.volt;
    }

    this.emit("data", data);

    setTimeout(this.update.bind(this), this.uploadTime);
  }
  get status() {
    if(this.evseConn) {
      this._status.comm_sent = this.evseConn.comm_sent;
      this._status.comm_success = this.evseConn.comm_success;
    }
    return this._status;
  }
  set status(newStatus) {
    super.status = newStatus;
  }
};
