/* jshint node: true, esversion: 6*/

"use strict";

var expect = require("chai").expect;
var fs = require("fs");

var config = require("../src/config");

describe("#config", function() {
  it("should save the config to disk", function() {
    config.path = "./test.json";
    config.save({test: true}).then(function () {
      expect(fs.existsSync(config.path));
      var data = fs.readFileSync(config.path);
      expect(JSON.parse(data).test);
    });
  });

  it("should load the config from disk", function() {
    config.path = "./test.json";
    fs.writeFile(config.path, "{\"load\":true}", function (err) {
      if (err) {
        console.log("There has been an error saving your configuration data.");
        console.log(err.message);
        return;
      }

      var opts = config.load({load: false});
      expect(opts.load);
    });
  });

});
