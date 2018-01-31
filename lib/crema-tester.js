/*
 * Copyright (c) 2018 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

(function () {
    "use strict";

    var path = require("path"),
        Q = require("q"),
        fse = require("fs-extra");

    var CREMA_CONFIG_FILE = "crema-components.json",
        CREMA_ASSSET_DIR = "crema-assets";

    /** 
     * Crema test runner.  Must supply the crema plugin upon construction.
     */
    class CremaTester {

        constructor (plugin) {
            if (!plugin._assetExtractor) {
                throw new Error("crema plugin not compatible");
            }
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
         * Get a crema components json file if it exists, otherwise use config from base directory.
         * The config values are elaborated with metadata values from the provided test object.
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
                    });
                });
        }

        /**
         * Given a test object, use crema to export one or more assets.
         *
         * @param {[type]} test
         * @return {[type]}
         */
        runTest(test) {
            var startTime;

            return this._getCremaTestConfig(test)
                .then((components) => {
                    console.log("Extracting crema components", components);
                    startTime = new Date();
                    return this.plugin._assetExtractor.exportComponents(components);
                })
                .then(() => {
                    test.cremaTestDuration = new Date() - startTime;
                    return test;
                });
        }
    }

    module.exports = CremaTester;

}());
