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
        OUTPUT_FOLDER_SUFFIX = "-assets",
        DISABLED_TEST_FOLDER_SUFFIX = "-disabled",
        MENU_ID = "generator-assets-automation",
        ASSETS_PLUGIN_ID = "generator-assets",
        ASSETS_PLUGIN_CHECK_INTERVAL = 1000, // one second
        GENERATION_ACTIVATION_TIMEOUT = 2000; // two seconds

    var path = require("path"),
        childProcess = require("child_process"),
        Q = require("q"),
        tmp = require("tmp"),
        fse = require("fs-extra");

    // clean up temp files even if there's an uncaught exception
    tmp.setGracefulCleanup(true);

    var _generator,
        _config,
        _logger,
        _assetsPluginDeferred = Q.defer(),
        _psExecutablePathPromise = null;

    function getAssetsPlugin() {
        return _assetsPluginDeferred.promise;
    }

    function getTestSpecForDir(baseDir) {
        return (Q.nfcall(fse.readdir, baseDir)
        .then(function (files) {
            var statPromises = files.map(function (f) {
                return Q.nfcall(fse.stat, path.resolve(baseDir, f))
                .then(function (stats) {
                    return {filename: f, stats: stats};
                });
            });

            return Q.all(statPromises);
        })
        .then(function (files) {
            var psds = [],
                directories = [],
                testFiles = [],
                test = null;

            files.forEach(function (file) {
                if (file.stats.isDirectory()) {
                    directories.push(file.filename);
                } else if (file.stats.isFile()) {
                    if (path.extname(file.filename).toLowerCase() === ".psd") {
                        psds.push(file.filename);
                    }
                }
            });

            psds.forEach(function (psd) {
                var base = path.basename(psd, path.extname(psd)),
                    i = directories.indexOf(base + OUTPUT_FOLDER_SUFFIX);
                if (i >= 0) {
                    testFiles.push({
                        input: psd,
                        output: directories[i]
                    });
                }
            });

            // Note: This function can find multiple psd/output dir pairs, which
            // we might want in the future. However, the test running code doesn't
            // support multiple PSDs per test (because the old assets plugin doesn't
            // have a good way to ensure generation is on for all of them after
            // they're opened). So, for now, we just return the first one.

            if (testFiles.length > 0) {
                test = {
                    baseDir : baseDir,
                    input : testFiles[0].input,
                    output : testFiles[0].output
                };
            }

            return test;
        }));
    }

    function getTests() {
        function isDisabledTestFolderName(filename) {
            return (filename.length > DISABLED_TEST_FOLDER_SUFFIX.length &&
                filename.lastIndexOf(DISABLED_TEST_FOLDER_SUFFIX) ===
                filename.length - DISABLED_TEST_FOLDER_SUFFIX.length);
        }

        return (Q.nfcall(fse.readdir, path.resolve(__dirname, TEST_PATH_ROOT))
        .then(function (files) {
            var statPromises = files.map(function (f) {
                return (Q.nfcall(fse.stat, path.resolve(__dirname, TEST_PATH_ROOT, f))
                .then(function (stats) {
                    return {filename: f, stats: stats};
                }));
            });

            return Q.all(statPromises);
        })
        .then(function (files) {
            var testDirs = files.filter(function (file) {
                return file.stats.isDirectory() && !isDisabledTestFolderName(file.filename);
            });

            var testPromises = testDirs.map(function (file) {
                return getTestSpecForDir(
                    path.resolve(__dirname, TEST_PATH_ROOT, file.filename)
                );
            });
            return Q.all(testPromises);
        })
        .then(function (tests) {
            var theTests = tests.filter(function (test) {
                return test !== null;
            });
            return theTests;
        }));
    }

    function closeAllPhotoshopDocuments() {
        return _generator.evaluateJSXFile(path.resolve(__dirname, "lib/jsx/closeAll.jsx"));
    }

    function openPhotoshopDocument(documentPath) {
        return _generator.evaluateJSXFile(
            path.resolve(__dirname, "lib/jsx/openFile.jsx"),
            {filename : documentPath}
        );
    }

    function setup(test) {
        return (closeAllPhotoshopDocuments()
        .then(function () {
            if (typeof(_config["working-directory"]) === "string") {
                var workingDir = path.resolve(
                    _config["working-directory"],
                    path.basename(test.baseDir)
                );
                return (Q.nfcall(fse.mkdirs, workingDir)
                .then(function () {
                    return workingDir;
                }));
            } else {
                return Q.nfcall(tmp.dir, {unsafeCleanup : true});
            }
        })
        .then(function (workingDir) {
            test.workingDir = workingDir;

            var source = path.resolve(test.baseDir, test.input),
                dest = path.resolve(test.workingDir, test.input);

            // Copy input to temp folder
            return Q.nfcall(fse.copy, source, dest);
        })
        .then(function () {
            return test;
        }));
    }

    function openAndGenerate(test) {
        var plugin = null;

        return (getAssetsPlugin()
        .then(function (thePlugin) {
            plugin = thePlugin;
        })
        .then(function () {
            return plugin._status.whenIdle();
        })
        .then(function () {
            var generatingDeferred = Q.defer(),
                whenActivePromise = plugin._status.whenActive(),
                activationTimeout = null;
   
            generatingDeferred.promise.finally(function () {
                if (activationTimeout !== null) {
                    clearTimeout(activationTimeout);
                }
            });

            whenActivePromise.then(function () {
                generatingDeferred.resolve();
            });

            openPhotoshopDocument(path.resolve(test.workingDir, test.input))
            .then(function (id) {
                test.documentID = id;

                activationTimeout = setTimeout(function () {
                    plugin._toggleActiveDocument();
                }, GENERATION_ACTIVATION_TIMEOUT);
            }, function (err) {
                generatingDeferred.reject("error opening temp Photoshop document: " + err);
            });

            return generatingDeferred.promise;
        })
        .then(function () {
            return plugin._status.whenIdle();
        }).then(function () {
            return test;
        }));
    }

    function getAllFiles(baseDirectory, additionalDirectories) {
        additionalDirectories = additionalDirectories || "";

        return (Q.nfcall(fse.readdir, path.resolve(baseDirectory, additionalDirectories))
        .then(function (files) {
            var statPromises = files.map(function (f) {
                return (Q.nfcall(fse.stat, path.resolve(baseDirectory, additionalDirectories, f))
                .then(function (stats) {
                    return {filename: f, stats: stats};
                }));
            });

            return Q.all(statPromises);
        })
        .then(function (filesAndDirectories) {
            var files = [],
                directories = [];

            filesAndDirectories.forEach(function (f) {
                if (f.stats.isDirectory()) {
                    directories.push(path.join(additionalDirectories, f.filename));
                } else if (f.stats.isFile()) {
                    files.push(path.join(additionalDirectories, f.filename));
                }
            });

            var recursePromises = directories.map(function (d) {
                return getAllFiles(baseDirectory, d);
            });

            return (Q.all(recursePromises)
            .then(function (recurseResults) {
                return Array.prototype.concat.apply(files, recurseResults);
            }));
        }));
    }

    function comparePixels(source, dest) {

        return (_psExecutablePathPromise
        .then(function (psPath) {
            var execpath,
                args,
                spawnDeferred = Q.defer();

            if (process.platform === "darwin") {
                execpath = path.resolve(psPath, "convert");
            } else {
                execpath = path.resolve(psPath, "convert.exe");
            }
            
            args = [
                "(", source, "-flatten", ")",
                "(", dest, "-flatten", ")",
                "-compose", "Difference",
                "-composite",
                "-colorspace", "gray",
                "-format", "%[mean]", "info:"
            ];

            var p = childProcess.spawn(execpath, args),
                result = "",
                err = "";

            p.stdout.setEncoding("utf8");
            p.stderr.setEncoding("utf8");

            p.stdout.on("data", function (data) {
                result += data;
            });

            p.stderr.on("data", function (data) {
                err += data;
            });

            p.on("close", function (code) {
                if (code === 0) {
                    spawnDeferred.resolve(parseFloat(result));
                } else {
                    spawnDeferred.reject(err);
                }
            });

            return spawnDeferred.promise;
        }));
    }

    function compare(test) {
        var result = {
            passed : false,
            specFiles : null,
            actualFiles : null,
            errors : [],
            comparisons : []
        };

        return (Q.all([
            getAllFiles(path.resolve(test.baseDir, test.output), ""),
            getAllFiles(path.resolve(test.workingDir, test.output), "")
        ]).spread(function (base, working) {
            var toCompare = [],
                comparePromises;

            result.specFiles = base.concat();
            result.actualFiles = working.concat();

            base.forEach(function (b) {
                var i = working.indexOf(b);
                if (i < 0) {
                    result.errors.push("file " + b + " missing from output");
                } else {
                    toCompare.push(b);
                    working.splice(i, 1);
                }
            });

            working.forEach(function (w) {
                result.errors.push("file " + w + " is unexpectedly in output");
            });

            comparePromises = toCompare.map(function (f) {
                return (comparePixels(
                    path.resolve(test.baseDir, test.output, f),
                    path.resolve(test.workingDir, test.output, f)
                )
                .then(function (metric) {
                    result.comparisons.push({file : f, metric : metric});
                    if (metric > 0) {
                        result.errors.push("file " + f + " has a comparison metric of " + metric);
                    }
                }));
            });

            return Q.all(comparePromises);
        })
        .then(function () {
            if (result.errors.length === 0) {
                result.passed = true;
            }
            test.result = result;
            return test;
        }));
    }

    function teardown(test) {
        if (_config.hasOwnProperty("cleanup") && _config.cleanup === false) {
            return Q.call(undefined, test);
        } else {
            return (Q.nfcall(fse.remove, test.workingDir)
            .then(function () {
                return test;
            }));
        }
    }

    function runTest(test) {
        _logger.info("TEST RUNNING: %j", test);

        return (setup(test)
        .then(openAndGenerate)
        .then(compare)
        .then(teardown)
        .then(function () {
            _logger.info("TEST COMPLETE:\n%s\n\n", JSON.stringify(test.result, null, "  "));
            return test;
        }, function (err) {
            _logger.info("TEST ERRORED:", err);
            test.result = err;
            return test;
        }));
    }

    function runAllTests() {
        _logger.info("Running all tests...");

        var results = [];

        return (getTests()
        .then(function (theTests) {
            var testFuncs = theTests.map(function (test) {
                return function () {
                    return (runTest(test)
                    .then(function (test) {
                        results.push(test.result);
                    }));
                };
            });

            testFuncs.unshift(getAssetsPlugin);
            testFuncs.push(closeAllPhotoshopDocuments);

            return testFuncs.reduce(function (soFar, f) {
                return soFar.then(f);
            }, Q.call());
        })
        .done(function () {
            _logger.info("...all tests done");
            _logger.info("ALL THE RESULTS:\n%s\n\n", JSON.stringify(results, null, "  "));
        }));
    }

    function init(generator, config, logger) {
        _generator = generator;
        _config = config;
        _logger = logger;

        _psExecutablePathPromise = _generator.getPhotoshopExecutableLocation();

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

        // runAllTests();

    }

    exports.init = init;

}());