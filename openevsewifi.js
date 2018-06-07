/* jshint node: true, esversion: 6*/

"use strict";

const openevse = require("./openevse");
const EmonCMS = require("./emoncms");

module.exports = class OpenEVSEWiFi
{
  constructor()
  {
    this.info = {
      firmware: "-",
      protocol: "-",
      espflash: 0,
      version: "0.0.1"
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
    this.config = {
      wifi: {
        ssid: "demo",
        pass: ""
      },
      emoncms: {
        enabled: false,
        server: "https://this.openevse.com/emoncms",
        node: "openevse",
        apikey: "",
        fingerprint: ""
      },
      mqtt: {
        enabled: false,
        server: "emonpi.local",
        topic: "openevse",
        user: "emonpi",
        pass: "emonpimqtt2016",
        solar: "",
        grid_ie: ""
      },
      www: {
        username: "",
        password: ""
      },
      ohm: {
        enabled: false
      },
    };
    this.status = {
      mode: "STA",
      wifi_client_connected: 1,
      srssi: -50,
      ipaddress: "172.16.0.191",
      emoncms_connected: 0,
      packets_sent: 0,
      packets_success: 0,
      mqtt_connected: 1,
      ohm_hour: "NotConnected",
      free_heap: 20816,
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
      divertmode: 1
    };

    // Time between sending a command to the OpenEVSE
    this.updateTime = 500;
    this.uploadTime = 30 * 1000;

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
      }.bind(this)); }.bind(this),
    ];

    // List of items to update on calling update(). The list will be processed one item at
    // a time.
    this.updateList = [
      function () { return this.evseConn.current_capacity(function (capacity) {
        this.status.pilot = capacity;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.status(function (state, elapsed) {
        this.status.state = state;
        this.status.elapsed = elapsed;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.charging_current_voltage(function (voltage, current) {
        this.status.voltage = voltage;
        this.status.amp = current;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.temperatures(function (temp1, temp2, temp3) {
        this.status.temp1 = temp1;
        this.status.temp2 = temp2;
        this.status.temp3 = temp3;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.energy(function (wattSeconds, whacc) {
        this.status.wattsec = wattSeconds;
        this.status.watthour = whacc;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.fault_counters(function (gfci_count, nognd_count, stuck_count) {
        this.status.gfcicount = gfci_count;
        this.status.nogndcount = nognd_count;
        this.status.stuckcount = stuck_count;
      }.bind(this)); }.bind(this),
    ];
  }

  runList(list, always, delay = 0, count = 0)
  {
    if(count >= list.length) {
      always();
      return;
    }

    var updateFn = list[count];
    updateFn().always(function () {
      setTimeout(function () {
        this.runList(list, always.bind(this), delay, count + 1);
      }.bind(this), delay);
    }.bind(this));
  }

  update() {
    this.runList(this.updateList, this.upload, this.updateTime);
  }

  upload()
  {
    var data = {
      amp: this.status.amp,
      wh: this.status.wattsec,
      temp1: this.status.temp1,
      temp2: this.status.temp2,
      temp3: this.status.temp3,
      pilot: this.status.pilot,
      state: this.status.state,
      freeram: 0,
      divertmode: this.status.divertmode
    };
    if (this.status.volt > 0) {
      data.volt = this.status.volt;
    }

    if(this.config.emoncms.enabled) {
      var emoncms = new EmonCMS(this.config.emoncms.apikey, this.config.emoncms.server);
      emoncms.nodegroup = this.config.emoncms.node;
      emoncms.datatype = "fulljson";
      this.status.packets_sent++;
      emoncms.post({
        payload: data
      }).then(function () {
        this.status.emoncms_connected = true;
        this.status.packets_success++;
      }).catch(function(error) {
        console.error("EmonCMS post Failed!", error);
      });
    }
    if(this.config.mqtt.enabled) {
    }
    if(this.config.ohm.enabled) {
    }
  }

  start(endpoint)
  {
    this.evseConn = openevse.connect(endpoint);
    this.runList(this.initList, function () {
      this.runList(this.updateList, function () {
        setTimeout(this.update.bind(this), this.updateTime);
        setInterval(this.upload.bind(this), this.uploadTime);
      }.bind(this));
    }.bind(this));
  }

  updateStatus() {
    this.status.comm_sent = this.evseConn.comm_sent;
    this.status.comm_success = this.evseConn.comm_success;
  }

  rapi(cmd, callback) {
    return this.evseConn.rawRequest(cmd, callback);
  }
};
