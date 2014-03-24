/*
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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

    var TEST_PATH_ROOT = "test/",
        INPUT_FOLDER_NAME = "input/",
        OUTPUT_FOLDER_NAME = "output",
        MENU_ID = "generator-assets-automation",
        ASSETS_PLUGIN_ID = "generator-assets",
        ASSETS_PLUGIN_CHECK_INTERVAL = 1000; // one second

    var path = require("path"),
        Q = require("q"),
        tmp = require("tmp"),
        fse = require("fs-extra");

    // clean up temp files even if there's an uncaught exception
    tmp.setGracefulCleanup(true);

    var _generator,
        _config,
        _logger,
        _assetsPluginDeferred = Q.defer();

    var tests = [
        {
            directory: "hello-world",
            inputFile: "hello-world.psd"
        }
    ];

    function getAssetsPlugin() {
        return _assetsPluginDeferred.promise;
    }

    function closeAllPhotoshopDocuments() {
        return _generator.evaluateJSXFile(path.resolve(__dirname, "lib/jsx/closeAll.jsx"));
    }

    function openPhotoshopDocument(documentPath) {
        _logger.warn("PS: opening %s", documentPath);
        return _generator.evaluateJSXFile(
            path.resolve(__dirname, "lib/jsx/openFile.jsx"),
            {filename : documentPath}
        );
    }

    function setup(test) {
        var deferred = Q.defer(),
            inputDir = path.resolve(__dirname, TEST_PATH_ROOT, test.directory, INPUT_FOLDER_NAME);

        // Create temp folder
        Q.nfcall(tmp.dir, {unsafeCleanup : true}).then(
            function (tempDir) {
                test.tempDir = tempDir;

                var source = path.resolve(inputDir, test.inputFile),
                    dest = path.resolve(test.tempDir, test.inputFile);

                // Copy input to temp folder
                Q.nfcall(fse.copy, source, dest).then(
                    function () {

                        // Open input file in PS
                        openPhotoshopDocument(dest).then(
                            function (id) {
                                test.documentID = id;
                                deferred.resolve(test);
                            },
                            function (err) {
                                deferred.reject("error opening temp Photoshop document: " + err);
                            }
                        );
                    },
                    function () {
                        deferred.reject("error copying input document to temp folder");
                    }
                );
            },
            function () {
                deferred.reject("error creating temp folder");
            }
        );
        return deferred.promise;
    }

    function compare(test) {
        _logger.warn("GOT TO COMPARE WITH %j", test);
        var deferred = Q.defer();
        setTimeout(function () {
            deferred.resolve(test);
        }, 4000);
        return deferred.promise;
    }

    function teardown(test) {
        _logger.warn("GOT TO TEARDOWN WITH %j", test);
        var deferred = Q.defer();

        Q.all([
            closeAllPhotoshopDocuments(),
            Q.nfcall(fse.remove(test.tempDir))
        ]).then(
            function () { return test; },
            function (err) { return "Error during teardown: " + err; }
        );

        return deferred.promise;
    }

    function runTest(test) {
        _logger.warn("TEST RUNNING", test.directory);

        setup(test).then(compare).then(teardown).done(function () {
            _logger.warn("TEST DONE", test.directory);
        });
    }

    function runAllTests() {
        getAssetsPlugin().then(function (plugin) {
            _logger.warn("GOT THE PLUGIN:", plugin);
            tests.forEach(runTest);
        });
    }

    function init(generator, config, logger) {
        _generator = generator;
        _config = config;
        _logger = logger;

        _generator.onPhotoshopEvent("generatorMenuChanged", function (e) {
            if (e.generatorMenuChanged.name === MENU_ID) {
                runAllTests();
            }
        });

        _generator.addMenuItem(
            MENU_ID,
            "Run Assets Automation",
            true,
            false
        );

        var getAssetsPluginInterval = setInterval(function () {
            var plugin = _generator.getPlugin(ASSETS_PLUGIN_ID);
            if (plugin) {
                _assetsPluginDeferred.resolve(plugin);
                clearInterval(getAssetsPluginInterval);
            }
        }, ASSETS_PLUGIN_CHECK_INTERVAL);

        runAllTests();

    }

    exports.init = init;

}());