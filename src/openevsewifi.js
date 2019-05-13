/* jshint node: true, esversion: 6*/

"use strict";

const config = require("./config");
const evse = require("./evse");
const emoncms = require("./emoncms");
const mqtt = require("./mqtt");
const ohmconnect = require("./ohmconnect");

const base = require("./base");
const network = require("network");
const debug = require("debug")("openevse:wifi");

module.exports = class OpenEVSEWiFi extends base
{
  constructor()
  {
    super();

    this._config = {
      wifi: {
        ssid: "demo",
        pass: ""
      },
      www: {
        username: "",
        password: ""
      }
    };
    this._status = {
      mode: "NA",
      wifi_client_connected: 0,
      srssi: 0,
      ipaddress: "",
      network_manager: "external",
    };
  }

  start(endpoint)
  {
    this.evse = new evse(endpoint);
    this.emoncms = new emoncms(this.evse);
    this.mqtt = new mqtt(this.evse);
    this.ohmconnect = new ohmconnect(this.evse);

    var options = config.load(this.config);
    this._config.wifi = Object.assign(this._config.wifi, options.wifi);
    this._config.www = Object.assign(this._config.www, options.www);

    this.evse.on("status", (changedData) => {
      this.emit("status", changedData);
    });
    this.emoncms.on("status", (changedData) => {
      this.emit("status", changedData);
    });
    this.mqtt.on("status", (changedData) => {
      this.emit("status", changedData);
    });
    this.ohmconnect.on("status", (changedData) => {
      this.emit("status", changedData);
    });

    this.evse.on("boot", () => {
      this.emoncms.connect(options.emoncms);
      this.mqtt.connect(options.mqtt);
      this.ohmconnect.connect(options.ohm);
      this.emit("boot");
    });

    network.get_active_interface((err, obj) => {
      if(err) {
        debug("Error getting IP address info", err);
        return;
      }

      var newStatus = { ipaddress: obj.ip_address };
      switch(obj.type)
      {
        case "Wired":
          newStatus.mode = "Wired";
          newStatus.wifi_client_connected = 0;
          break;
        case "Wireless":
          newStatus.mode = "STA";
          newStatus.wifi_client_connected = 1;
          break;
      }

      this.status = newStatus;
    });
  }

  get status() {
    return {
      mode: this._status.mode,
      wifi_client_connected: this._status.wifi_client_connected,
      srssi: this._status.srssi,
      ipaddress: this._status.ipaddress,
      network_manager: this._status.network_manager,
      emoncms_connected: this.emoncms.status.emoncms_connected,
      packets_sent: this.emoncms.packets_sent,
      packets_success: this.emoncms.packets_success,
      mqtt_connected: this.mqtt.status.mqtt_connected,
      ohm_hour: this.ohmconnect.status.ohm_hour,
      ohm_started_charge: this.ohmconnect.status.ohm_started_charge,
      free_heap: this.evse.status.free_heap,
      comm_sent: this.evse.status.comm_sent,
      comm_success: this.evse.status.comm_success,
      amp: this.evse.status.amp,
      pilot: this.evse.status.pilot,
      temp1: this.evse.status.temp1,
      temp2: this.evse.status.temp2,
      temp3: this.evse.status.temp3,
      state: this.evse.status.state,
      elapsed: this.evse.status.elapsed,
      wattsec: this.evse.status.wattsec,
      watthour: this.evse.status.watthour,
      gfcicount: this.evse.status.gfcicount,
      nogndcount: this.evse.status.nogndcount,
      stuckcount: this.evse.status.stuckcount,
      divertmode: this.evse.status.divertmode,
      solar: this.evse.status.solar,
      grid_ie: this.evse.status.grid_ie,
      charge_rate: this.evse.status.charge_rate,
      divert_update: this.evse.status.divert_update
    };
  }
  set status(newStatus) {
    super.status = newStatus;
  }

  get config() {
    return {
      wifi: this._config.wifi,
      www: this._config.www,
      emoncms: this.emoncms.config,
      mqtt: this.mqtt.config,
      ohm: {
        enabled: this.ohmconnect.enabled,
        key: this.ohmconnect.key
      }
    };
  }

  set config(options)
  {
    var modified, updated;
    debug(options);

    if(options.emoncms)
    {
      ({ modified, updated } = this.updateConfig(this.config.emoncms, options.emoncms));
      if(modified) {
        this.emoncms.connect(updated);
        config.save(this.config);
      }
    }
    if(options.mqtt)
    {
      ({ modified, updated } = this.updateConfig(this.config.mqtt, options.mqtt));
      if(modified) {
        this.mqtt.connect(updated);
        config.save(this.config);
      }
    }
    if(options.ohm)
    {
      ({ modified, updated } = this.updateConfig(this.config.ohm, options.ohm));
      if(modified) {
        this.ohmconnect.connect(updated);
        config.save(this.config);
      }
    }
  }

  updateConfig(existing, options) {
    var modified = false;
    for (const key in existing) {
      if (existing.hasOwnProperty(key)) {
        if (options.hasOwnProperty(key) && existing[key] !== options[key]) {
          existing[key] = options[key];
          modified = true;
        }
      }
    }
    return { modified: modified, updated: existing };
  }
};
