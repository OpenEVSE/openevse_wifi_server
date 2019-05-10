/* jshint node: true, esversion: 6*/

"use strict";

const mqtt = require("mqtt");

const EventEmitter = require("events");
const debug = require("debug")("openevse:mqtt");

module.exports = class extends EventEmitter
{
  constructor(evse)
  {
    super();
    this.evse = evse;
    this.client = false;

    this._status = {
      mqtt_connected: 0
    };

    this.config = {
      enabled: false,
      protocol: "mqtt",
      server: "emonpi.local",
      port: 1883,
      reject_unauthorized: true,
      topic: "openevse",
      user: "emonpi",
      pass: "emonpimqtt2016",
      solar: "",
      grid_ie: ""
    };

    this.evse.on("status", (status) => {
      this.publish(status);
    });

    this.evse.on("data", (data) => {
      this.publish(data);
    });

  }

  connect(config)
  {
    this.config = config;
    debug(this.config);

    this.status = {
      mqtt_connected: 0
    };
    if(this.config.enabled)
    {
      var opts = { rejectUnauthorized: this.config.reject_unauthorized };

      if(this.config.user && this.config.pass)
      {
        opts.username = this.config.user;
        opts.password = this.config.pass;
      }

      var client = mqtt.connect(this.config.protocol+"://"+this.config.server+":"+this.config.port, opts);
      client.on("connect", () =>
      {
        this.status = { mqtt_connected: 1 };
        client.subscribe(this.config.topic + "/rapi/in/#");
        client.subscribe(this.config.topic + "/divertmode/set");
        if(this.config.grid_ie) {
          client.subscribe(this.config.grid_ie);
        }
        if(this.config.solar) {
          client.subscribe(this.config.solar);
        }
      });

      client.on("message", (topic, message) => {
        debug(topic + ": " + message.toString());
        if(topic.startsWith(this.config.topic + "/rapi/in/")) {
          // TODO
        }
        if(topic === this.config.topic + "/divertmode/set") {
          this.evse.divert.mode = parseInt(message);
        }
        if(topic === this.config.grid_ie) {
          var grid_ie = parseFloat(message);
          this.evse.divert.grid_ie = grid_ie;
          this.evse.status = { grid_ie: grid_ie, divert_update: 0 };
        }
        if(topic === this.config.solar) {
          var solar = parseFloat(message);
          this.evse.divert.solar = solar;
          this.evse.status = { solar: solar, divert_update: 0 };
        }
      });

      client.on("error", (error) => {
        debug("MQTT error", error);
      });
      this.client = client;
    }

    return false;
  }

  publish(data) {
    if (this.config.enabled && this.status.mqtt_connected) {
      for (var name in data) {
        if (data.hasOwnProperty(name)) {
          var topic = this.config.topic + "/" + name;
          this.client.publish(topic, String(data[name]));
        }
      }
    }
  }

};
