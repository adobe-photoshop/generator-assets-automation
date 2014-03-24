/*global params, File, app */

// Required params:
//   - filename - file to open

var fileRef = new File(params.filename);
var doc = app.open(fileRef);
doc.id;
