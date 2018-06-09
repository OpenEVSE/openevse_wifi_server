// EmonCMS comms library
//
// Based (loosely) on https://github.com/node-red/node-red-nodes/

/* jshint node: true, esversion: 6*/

"use strict";

module.exports = class EmonCMS
{
  constructor(apikey = false, baseurl = false)
  {
    this.baseurl = baseurl || "https://emoncms.org";
    this.apikey = apikey || "";
    if (this.baseurl.substring(0, 5) === "https") { this.http = require("https"); }
    else { this.http = require("http"); }
  }

  post(msg)
  {
    return new Promise(function(resolve, reject)
    {
      // setup the data for the URI
      if (this.datatype === "legacy") {
        this.url = this.baseurl + "/input/post.json?";
        if (typeof (msg.payload) !== "string") {
          this.url += "json=" + JSON.stringify(msg.payload);
        }
        else {
          if (msg.payload.indexOf(":") > -1) {
            this.url += "json={" + msg.payload + "}";
          }
          else {
            this.url += "csv=" + msg.payload;
          }
        }
      }
      else if (this.datatype === "fulljson") {
        this.url = this.baseurl + "/input/post?";
        this.url += "fulljson=" + encodeURIComponent(JSON.stringify(msg.payload));
      }
      else if (this.datatype === "json") {
        this.url = this.baseurl + "/input/post?";
        this.url += "json={" + encodeURIComponent(msg.payload) + "}";
      }
      else if (this.datatype === "CSV") {
        this.url = this.baseurl + "/input/post?";
        this.url += "csv=" + msg.payload;
      }
      else {
        reject(Error("datatype not known"));
        return;
      }

      // setup the node group for URI. Must have a node group or exit
      var nodegroup = this.nodegroup || msg.nodegroup;
      if (typeof nodegroup === "undefined") {
        reject(Error("A Node group must be specified - " + nodegroup));
        return;
      } else {
        this.url += "&node=" + nodegroup;
      }

      // setup the API key for URI.
      this.url += "&apikey=" + this.apikey;

      // check for a time object and setup URI if valid
      if (typeof msg.time === "undefined") {
        // node.warn("WARN: Time object undefined, no time set");
      }
      else {
        if (!isNaN(msg.time)) {
          this.url += "&time=" + msg.time;
        }
        else {
          if (isNaN(Date.parse(msg.time))) {
            // error condition as msg.tme has some value that is not understood
            // node.warn("WARN: Time object not valid, no time set - " + msg.time);
          } else {
            this.url += "&time=" + Date.parse(msg.time) / 1000; //seconds
          }
        }
        delete msg.time; // clean it up for the error msg
      }
      var URIsent = this.url;

      msg.payload = "";
      msg.urlsent = decodeURIComponent(URIsent);

      var request = this.http.get(this.url, function (res)
      {
        msg.topic = "http response";
        msg.rc = res.statusCode;
        res.setEncoding("utf8");
        var body = "";

        res.on("data", function (chunk) {
          body += chunk;
        });

        res.on("end", function () {
          // need to test for JSON as some responses are not valid JSON
          try {
            msg.payload = JSON.parse(body);
          }
          catch (e) {
            msg.payload = body;
          }

          if (msg.payload.success || msg.payload === "ok") {
            resolve(msg);
            // node.status({ fill: "green", shape: "dot", text: "ok RC=" + msg.rc });
          }
          else if (msg.payload === "Invalid API key") {
            reject(Error("Invalid API key"));
            // node.status({ fill: "red", shape: "ring", text: "Invalid API key RC=" + msg.rc });
          } else {
            reject(Error("API Call Failed"));
            // node.status({ fill: "red", shape: "ring", text: "API Failed RC=" + msg.rc });
          }
        });
      }).on("error", function (e) {
        reject(Error(e));
        // node.status({ fill: "red", shape: "dot", text: "HTTP Error" });
      });
      request.setTimeout(6000, function () {
        reject(Error("HTTP Timeout"));
        // node.status({ fill: "red", shape: "ring", text: "HTTP Timeout" });
      });
    }.bind(this));
  }
};
