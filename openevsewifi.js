/* jshint node: true, esversion: 6*/

"use strict";

const openevse = require("./openevse");
const EmonCMS = require("./emoncms");
const mqtt = require("mqtt");

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
    this._config = {
      wifi: {
        ssid: "demo",
        pass: ""
      },
      emoncms: {
        enabled: false,
        server: "https://data.openevse.com/emoncms",
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
    this._status = {
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
        this._status.pilot = capacity;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.status(function (state, elapsed) {
        this._status.state = state;
        this._status.elapsed = elapsed;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.charging_current_voltage(function (voltage, current) {
        this._status.voltage = voltage;
        this._status.amp = current;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.temperatures(function (temp1, temp2, temp3) {
        this._status.temp1 = temp1;
        this._status.temp2 = temp2;
        this._status.temp3 = temp3;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.energy(function (wattSeconds, whacc) {
        this._status.wattsec = wattSeconds;
        this._status.watthour = whacc;
      }.bind(this)); }.bind(this),
      function () { return this.evseConn.fault_counters(function (gfci_count, nognd_count, stuck_count) {
        this._status.gfcicount = gfci_count;
        this._status.nogndcount = nognd_count;
        this._status.stuckcount = stuck_count;
      }.bind(this)); }.bind(this),
    ];

    this.mqttBroker = this.connectToMqttBroker();
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
      amp: this._status.amp,
      wh: this._status.wattsec,
      temp1: this._status.temp1,
      temp2: this._status.temp2,
      temp3: this._status.temp3,
      pilot: this._status.pilot,
      state: this._status.state,
      freeram: 0,
      divertmode: this._status.divertmode
    };
    if (this._status.volt > 0) {
      data.volt = this._status.volt;
    }

    if(this._config.emoncms.enabled) {
      var emoncms = new EmonCMS(this._config.emoncms.apikey, this._config.emoncms.server);
      emoncms.nodegroup = this._config.emoncms.node;
      emoncms.datatype = "fulljson";
      this._status.packets_sent++;
      emoncms.post({
        payload: data
      }).then(function () {
        this._status.emoncms_connected = 1;
        this._status.packets_success++;
      }.bind(this)).catch(function(error) {
        console.error("EmonCMS post Failed!", error);
      });
    }
    if(this._config.mqtt.enabled && this._status.mqtt_connected)
    {
      for(var name in data) {
        var topic = this._config.mqtt.topic + "/" + name;
        this.mqttBroker.publish(topic, String(data[name]));
      }
    }
    if(this._config.ohm.enabled) {
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

  rapi(cmd, callback) {
    return this.evseConn.rawRequest(cmd, callback);
  }

  connectToMqttBroker()
  {
    this.status.mqtt_connected = false;
    if(this.config.mqtt.enabled)
    {
      var opts = { };

      if(this.config.mqtt.user && this.config.mqtt.pass)
      {
        opts.username = this.config.mqtt.user;
        opts.password = this.config.mqtt.pass;
      }

      var client = mqtt.connect("mqtt://"+this.config.mqtt.server, opts);
      client.on("connect", function () {
        this.status.mqtt_connected = true;
      }.bind(this));
      return client;
    }

    return false;
  }

  get status() {
    if(this.evseConn) {
      this._status.comm_sent = this.evseConn.comm_sent;
      this._status.comm_success = this.evseConn.comm_success;
    }
    return this._status;
  }

  get config() {
    return this._config;
  }

  set config(options)
  {
    var modified;
    if(options.emoncms)
    {
      modified = false;
      if(options.emoncms.enabled && this._config.emoncms.enabled !== options.emoncms.enabled) {
        this._config.emoncms.enabled = options.emoncms.enabled;
        modified = true;
      }
      if(options.emoncms.server && this._config.emoncms.server !== options.emoncms.server) {
        this._config.emoncms.server = options.emoncms.server;
        modified = true;
      }
      if(options.emoncms.node && this._config.emoncms.node !== options.emoncms.node) {
        this._config.emoncms.node = options.emoncms.node;
        modified = true;
      }
      if(options.emoncms.apikey && this._config.emoncms.apikey !== options.emoncms.apikey) {
        this._config.emoncms.apikey = options.emoncms.apikey;
        modified = true;
      }
      if(options.emoncms.fingerprint && this._config.emoncms.fingerprint !== options.emoncms.fingerprint) {
        this._config.emoncms.fingerprint = options.emoncms.fingerprint;
        modified = true;
      }
      if(modified) {
        this._status.emoncms_connected = 0;
      }
    }
    if(options.mqtt)
    {
      modified = false;
      if(options.mqtt.enabled && this._config.mqtt.enabled !== options.mqtt.enabled) {
        this._config.mqtt.enabled = options.mqtt.enabled;
        modified = true;
      }
      if(options.mqtt.server && this._config.mqtt.server !== options.mqtt.server) {
        this._config.mqtt.server = options.mqtt.server;
        modified = true;
      }
      if(options.mqtt.topic && this._config.mqtt.topic !== options.mqtt.topic) {
        this._config.mqtt.topic = options.mqtt.topic;
        modified = true;
      }
      if(options.mqtt.user && this._config.mqtt.user !== options.mqtt.user) {
        this._config.mqtt.user = options.mqtt.user;
        modified = true;
      }
      if(options.mqtt.pass && this._config.mqtt.pass !== options.mqtt.pass) {
        this._config.mqtt.pass = options.mqtt.pass;
        modified = true;
      }
      if(options.mqtt.solar && this._config.mqtt.solar !== options.mqtt.solar) {
        this._config.mqtt.solar = options.mqtt.solar;
        modified = true;
      }
      if(options.mqtt.grid_ie && this._config.mqtt.grid_ie !== options.mqtt.grid_ie) {
        this._config.mqtt.grid_ie = options.mqtt.grid_ie;
        modified = true;
      }

      if(modified) {
        this.mqttBroker = this.connectToMqttBroker();
      }
    }
  }
};
