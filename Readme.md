# Boogle

Boggle (tm) is a word game: There are 16 letter cubes, which are cast into a 4-by-4 grid. Players aim to find unique words of three characters or more, by combining adjacent letters horizontally, vertically, or diagonally. Letters must be used in order of their interconnection, and each letter cube may only be used once per word.

Boogle is a web-app which solves such a grid by finding all dictionary words within the grid. The grid is input to the program by scanning it with a camera. Some simple transformations are applied to the image, and optical character recognition is used to try and recognize each character.

## Status

This project is a work in progress. A number of important features are still missing:

* Rotating characters before the OCR step, as cubes may fall in any orientation.
* Differentiating between W and M (there is a thin line on the cube to indicate the base)
* Handling the letter "Qu", as currently only single characters are used
* Testing on mobile devices and further improving OCR preparation, and run character recognition and preparation in separate threads for performance.

## Acknowledgements

* [ocrad.js](https://github.com/antimatter15/ocrad.js) (GPL v3) is a Javascript port of the OCRAD ocr program. It is used unchanged.
* Production versions of jQuery (MIT) and underscore.js (MIT) are also used unchanged.
* The game rules for Boggle are protected by copyright and trademark by Hasbro. This application does not actually allow playing the game, but rather calculates solutions to an interesting problem posed by its premise.
