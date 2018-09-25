/* jshint node: true, esversion: 6*/

"use strict";

const config = require("./config");
const divert = require("./divertmode");

const openevse = require("openevse");
const EmonCMS = require("emoncms");
const OhmHour = require("ohmhour");
const mqtt = require("mqtt");
const EventEmitter = require("events");

module.exports = class OpenEVSEWiFi extends EventEmitter
{
  constructor()
  {
    super();

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
        enabled: false,
        key: ""
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
      ohm_started_charge: false,
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

    this.uploadEmonCms(data);
    this.uploadMqtt(data);

    setTimeout(this.update.bind(this), this.uploadTime);
  }

  uploadMqtt(data) {
    if (this._config.mqtt.enabled && this._status.mqtt_connected) {
      for (var name in data) {
        var topic = this._config.mqtt.topic + "/" + name;
        this.mqttBroker.publish(topic, String(data[name]));
      }
    }
  }

  uploadEmonCms(data) {
    if (this._config.emoncms.enabled) {
      var emoncms = new EmonCMS(this._config.emoncms.apikey, this._config.emoncms.server);
      emoncms.nodegroup = this._config.emoncms.node;
      emoncms.datatype = "fulljson";
      this.status =  { packets_sent: this._status.packets_sent + 1 };
      emoncms.post({
        payload: data
      }).then(function () {
        this.status = {
          emoncms_connected: 1,
          packets_success: this._status.packets_success + 1
        };
      }.bind(this)).catch(function (error) {
        console.error("EmonCMS post Failed!", error);
      });
    }
  }

  checkOhmHour() {
    if (this._config.ohm.enabled) {
      var ohm = new OhmHour(this._config.ohm.key);
      ohm.check().then(function (state) {
        if(state != this._status.ohm_hour)
        {
          if("True" === state)
          {
            this.evseConn.status(function () {
              this.status = {
                ohm_hour: state,
                ohm_started_charge: true
              };
            }.bind(this), "enable");
          }
          else if(this._status.ohm_started_charge)
          {
            this.evseConn.status(function () {
              this.status = {
                ohm_hour: state,
                ohm_started_charge: false
              };
            }.bind(this), "sleep");
          }
        }
      }.bind(this)).catch(function (error) {
        console.error("OhmHour check Failed!", error);
      });
    }
  }

  start(endpoint)
  {
    this._config = config.load(this._config);

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

    this.mqttBroker = this.connectToMqttBroker();
    this.on("status", (status) => {
      this.uploadMqtt(status);
      if(status.state) {
        this.divert.state = status.state;
      }
    });

    this.runList(this.initList, function () {
      this.update();
    }.bind(this));


    setInterval(this.checkOhmHour.bind(this), this.ohmTime);
  }

  rapi(cmd, callback) {
    return this.evseConn.rawRequest(cmd, callback);
  }

  connectToMqttBroker()
  {
    this.status = {
      mqtt_connected: 0
    };
    if(this.config.mqtt.enabled)
    {
      var opts = { };

      if(this.config.mqtt.user && this.config.mqtt.pass)
      {
        opts.username = this.config.mqtt.user;
        opts.password = this.config.mqtt.pass;
      }

      var client = mqtt.connect("mqtt://"+this.config.mqtt.server, opts);
      client.on("connect", () =>
      {
        this.status = { mqtt_connected: 1 };
        client.subscribe(this.config.mqtt.topic + "/rapi/in/#");
        client.subscribe(this.config.mqtt.topic + "/divertmode/set");
        if(this.config.mqtt.grid_ie) {
          client.subscribe(this.config.mqtt.grid_ie);
        }
        if(this.config.mqtt.solar) {
          client.subscribe(this.config.mqtt.solar);
        }
      });

      client.on("message", (topic, message) => {
        console.log(topic + ": " + message.toString());
        if(topic.startsWith(this.config.mqtt.topic + "/rapi/in/")) {
          // TODO
        }
        if(topic === this.config.mqtt.topic + "/divertmode/set") {
          this.divert.mode = parseInt(message);
        }
        if(topic === this.config.mqtt.grid_ie) {
          this.divert.grid_ie = parseFloat(message);
        }
        if(topic === this.config.mqtt.solar) {
          this.divert.solar = parseFloat(message);
        }
      });
      return client;
    }

    return false;
  }

  get status() {
    if(this.evseConn) {
      this._status.comm_sent = this.evseConn.comm_sent;
      this._status.comm_success = this.evseConn.comm_success;
    }
    var mem = process.memoryUsage();
    this._status.free_heap = mem.heapTotal - mem.heapUsed;
    return this._status;
  }

  set status(newStatus)
  {
    var changedData = {};
    var changed = false;
    for (const prop in newStatus) {
      if (newStatus.hasOwnProperty(prop)) {
        if(this._status[prop] !== newStatus[prop]) {
          this._status[prop] = newStatus[prop];
          changedData[prop] = newStatus[prop];
          changed = true;
        }
      }
    }
    if(changed) {
      this.emit("status", changedData);
    }
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
        this.status = { emoncms_connected: 0 };
        config.save(this._config);
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
        config.save(this._config);
      }
    }
    if(options.ohm)
    {
      modified = false;
      if(options.ohm.enabled && this._config.ohm.enabled !== options.ohm.enabled) {
        this._config.ohm.enabled = options.ohm.enabled;
        modified = true;
      }
      if(options.ohm.key && this._config.ohm.key !== options.ohm.key) {
        this._config.ohm.key = options.ohm.key;
        modified = true;
      }
      if(modified) {
        this.status = { ohm_hour: "NotConnected" };
        config.save(this._config);
      }
    }
  }
};
