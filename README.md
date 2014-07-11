## Image Asset Automation Plug-in for Generator [![Build Status](https://travis-ci.org/adobe-photoshop/generator-assets-automation.png?branch=master)](https://travis-ci.org/adobe-photoshop/generator-assets-automation)

This repository contains a plug-in for Adobe Photoshop CC's Generator extensibility layer. This plug-in performs automated tests of the [Generator Image Asset plug-in](https://github.com/adobe-photoshop/generator-assets). 

To learn more about Generator and creating your own Generator plug-ins, please visit the [Generator Core repo](https://github.com/adobe-photoshop/generator-core).

### Usage

To run the automation plug-in, first close all open documents and then select "Run Assets Automation" from the Generate menu.

### Plug-in Configuration

The plug-in can be configured in your user-level `generator.json` file with the following options:

1. `working-directory` - default value: a temporary directory - Indicates the directory into which assets are generated while running tests
2. `cleanup` - default value: `true` - Indicates whether or not assets generated while runing tests should be cleaned up afterwards.

### License

(MIT License)

Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
