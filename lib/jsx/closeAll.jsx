/*global app, SaveOptions */

// Required params: none

while (true) {
    try {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES)
    } catch (e) {
        break;
    }
}