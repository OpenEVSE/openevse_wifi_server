// OhmHour check library

/* jshint node: true, esversion: 6*/

"use strict";

const http = require("https");
const xmldoc = require("xmldoc");

module.exports = class OhmHour
{
  constructor(key)
  {
    this.url = "https://login.ohmconnect.com/verify-ohm-hour/"+key;
  }

  check()
  {
    return new Promise(function(resolve, reject)
    {
      var request = http.get(this.url, function (res)
      {
        res.setEncoding("utf8");
        var body = "";

        res.on("data", function (chunk) {
          body += chunk;
        });

        res.on("end", function ()
        {
          var payload;
          try {
            payload = new xmldoc.XmlDocument(body);
            resolve(payload.valueWithPath("active"));
          }
          catch (e) {
            reject(Error(body));
          }
        });
      }).on("error", function (e) {
        reject(Error(e));
      });
      request.setTimeout(6000, function () {
        reject(Error("HTTP Timeout"));
      });
    }.bind(this));
  }
};
