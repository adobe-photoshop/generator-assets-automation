(function () {
    "use strict";

var path = require("path"),
    Q = require("q"),
    fse = require("fs-extra");

// TODO this will be a module that takes in the plugin on construction
// that will start fetching the default config
// "test" method will take in a test
var CREMA_CONFIG_FILE = "crema-components.json",
    CREMA_ASSSET_DIR = "crema-assets";

class CremaTester {

    constructor (plugin) {
        this.defaultConfig = this._fetchConfig();
        this.plugin = plugin;
    }

    /**
     * Fetch and parse a config file, omit param to fetch default
     *
     * @param {Path=} dir
     * @return {Promise.Array}
     */
    _fetchConfig(dir) {
        //
        var _dir = (dir === undefined) ? path.resolve(__dirname, "../") : dir,
            configPath = path.resolve(_dir, CREMA_CONFIG_FILE);

        return Q.ninvoke(fse, "stat", configPath).then(function (stats) {
            if (!stats.isFile()) {
                return [];
            }

            console.log("Reading default file", configPath);

            return Q.ninvoke(fse, "readFile", configPath, { encoding: "utf8" })
                .then(function (data) {
                    try {
                        var obj = JSON.parse(data);

                        if (Array.isArray(obj)) {
                            return obj;
                        } else {
                            console.error("Unable to parse crema test config, expected Array:", configPath);
                            return [];
                        }
                    } catch (ex) {
                        console.error("Unable to parse crema test config %s:", configPath, ex.message);
                        return [];
                    }
                });
        }, function () {
            return [];
        });
    }


    /**
     * get a crema components json file if it exists, otherwise
     *
     * @param {object} test
     * @return {Promise.Array}
     */
    _getCremaTestConfig(test) {
        return this._fetchConfig(test.baseDir)
            .then((components) => {
                if (!components || components.length === 0) {
                    return this.defaultConfig;
                }
                return components;
            })
            .then((components) => {
                // decorate with test-specific items
                return components.map((component) => {
                    var basename = component.basename || test.name + "-" + component.scale,
                        filename = component.file || basename + "." + component.extension;

                    return Object.assign({}, component, {
                        file: filename,
                        basename: basename,
                        path: path.resolve(test.workingDir, CREMA_ASSSET_DIR, filename),
                        documentId: test.documentID
                    });

                    return component;
                });
            });
    }

    runTest(test) {
        return this._getCremaTestConfig(test)
            .then((components) => {
                 console.log("Extracting crema components", components);
                 return this.plugin._assetExtractor.exportComponents(components);
            })
            .then((results) => {
                console.log("Extracted from Crema", results);
                return test;
            });
    }

}

module.exports = CremaTester;

}());
