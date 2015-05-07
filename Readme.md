# Boogle

Boggle (tm) is a word game: There are 16 letter cubes, which are cast into a 4-by-4 grid. Players aim to find unique words of three characters or more, by combining adjacent letters horizontally, vertically, or diagonally. Letters must be used in order of their interconnection, and each letter cube may only be used once per word.

Boogle is a web-app which solves such a grid by finding all dictionary words within the grid. The grid is input to the program by scanning it with a camera. Some simple transformations are applied to the image, and optical character recognition is used to try and recognize each character.

## Requirements
The application is currently only being tested in Chrome 42 for Windows and Android 4.4 on a Nexus 4. It should also work in the latest versions of Firefox and other compliant browsers.

A camera accessible to the browser is required as the application is based on image capture.

## Status

This project is a work in progress.

A number of important features are still missing:

* Rotating characters before the OCR step, as cubes may fall in any orientation.
* Once rotation is added, differentiating between W and M (there is a thin line on the cube to indicate the base).
* Multi-threading, and promise-based non-blocking user interface.

It would also be nice to allow manual input or correction of characters, rather than always relying on the OCR.
## Acknowledgements

* [ocrad.js](https://github.com/antimatter15/ocrad.js) (GPL v3) is a Javascript port of the OCRAD ocr program.
* Production versions of jQuery (MIT) and underscore.js (MIT).
* The game rules for Boggle are protected by copyright and trademark by Hasbro. This application does not actually allow playing the game, but rather calculates solutions to an interesting problem.


## Useful Links
* Canvas: [MDN Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
* Javascript Promises: [MDN Promise](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise)
* getUserMedia: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
* getUserMedia source selection with MediaStreamTrack.getSources: [HTML5Rocks getUserMedia](http://www.html5rocks.com/en/tutorials/getusermedia/intro/#toc-gettingstarted)
