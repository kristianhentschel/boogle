function boogle() {
    dict = {};

    function make_dict() {
    }

    function is_word(s) {
        return s in dict;
    }

    function mark(state, x, y) {
        return state | ((1 << x) * 4 + y);
    };


    function seen(state, x, y) {
        return state & ((1 << x) * 4 + y);
    }

    function solve(letters, cb) {
        // generate all valid combinations of letters
        words = [
            {word: "Foo", positions: [1, 2, 3]},
            {word: "Bar", positions: [7, 3, 4]}
        ];

        // filter out duplicates

        // filter out everything that's not a word

        // sort by length

        // finally, give resulting array to the callback
        cb(words);
    }


    // init
    make_dict();

    return {
        solve: solve
    };
}

function capture() {
    var video = document.getElementById("capture-video");
    var canvas = document.getElementById("capture-canvas");

    function init(){
        // Polyfill from https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
        navigator.mediaDevices = navigator.mediaDevices || ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
           getUserMedia: function(c) {
             return new Promise(function(y, n) {
               (navigator.mozGetUserMedia ||
                navigator.webkitGetUserMedia).call(navigator, c, y, n);
             });
           }
        } : null);

        // Request the camera and display the preview
        navigator.mediaDevices.getUserMedia({audio:false, video:true, frameRate:{ideal:25}})
        .then(function(stream) {
            video.src = window.URL.createObjectURL(stream);
            video.onloadedmetadata = function(e) {
                console.log("play");
                video.play();
            };
        })
        .catch(function(err) {
            $("#error")
            .text("No camera accessible (" + err.name + ": " + err.message + ").")
            .show();

            $("#main").hide();
        });
    }
    
    function capture(cb) {
        // stop the video
        video.pause();

        // recognise a single letter, uppercase ASCII only, black on white.
        var ocrad_options = {
            charset: 'ascii'
        }

        // prepare results array
        var letters = [];
        for(i = 0; i < 16; i++) {
            letters.push('?');
        }

        // total video dimensons
        var w = video.videoWidth;
        var h = video.videoHeight;
       
        // dimensions and top left coordinates of square crop preview 
        var grid_width = Math.min(w, h); 
        var grid_x = (w - grid_width)/2;
        var grid_y = (h - grid_width)/2;

        // side of a single letter cell
        var lw = grid_width / 4;

        // For each letter, crop the corresponding part of the still frame and try to recognize it.
        for(var i = 0; i < 4; i++) {
            for(var j = 0; j < 4; j++) {
                var canvas = document.createElement("canvas");
                canvas.width = lw;
                canvas.height = lw;
                var ctx = canvas.getContext("2d");
                ctx.drawImage(video, grid_x + i * lw, grid_y + j * lw, lw, lw, 0, 0, lw, lw);

                // try to adjust contrast, apply vignette, etc.
                ctx2 = prepare_ocr(ctx, lw);

                // TODO: rotation needs to be added before OCR step...
                letters[4*j + i] = OCRAD(ctx, ocrad_options)

                $("body").append(canvas);
            }
        }

        cb(letters);
    }

    function reset() {
        $(video).show();
        video.play();
    }

    function prepare_ocr(ctx, w) {
        var imageData = ctx.getImageData(0, 0, w, w);
        var data = imageData.data;
        
        // find black and white points by taking some samples
        var white = 0;
        var black = 255;
        var sample_distance = data.length / 4 / 400;

        for(var i = 0; i < data.length; i += sample_distance * 4) {
            var grey = (data[i] + data[i+1] + data[i+2]) / 3;
            white = Math.max(grey, white);
            black = Math.min(grey, black);
        }

        // convert to gray scale and apply black/white level adjustment
        for(var i = 0; i < data.length; i += 4) {
            var avg = (data[i] + data[i+1] + data[i+2]) / 3;
            var scaled = (1.0 * avg - black) / (white - black) * 255;
            data[i]   = scaled;
            data[i+1] = scaled;
            data[i+2] = scaled;
        }

        // vignette, rotate, variants...

        // return the modified image data
        ctx.putImageData(imageData, 0, 0);
    }

    return {
        init: init,
        capture: capture,
        reset: reset
    };
}

$(function() {
    // test solver
    b = boogle($);
    b.solve(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'], function(sol){
        console.log(sol);
    });

    // capture
    c = capture();
    c.init();

    // buttons and UI
    $("#solve").on("click", function() { 
        // recognize letters
        c.capture(function(letters){
            // display recognized letters
            $("#grid").empty();
            for (var i = 0; i < letters.length; i++) {
                $("<li>").text(letters[i]).appendTo($("#grid"));    
            }

            // find all words in the grid
            results = b.solve(letters, function(words) {
                // display found words
                $("#words").empty();
                for(var i = 0; i < words.length; i++) {
                    $("<li>")
                        .text(words[i].word)
                        .on("click mouseover", words[i].positions, function(e){
                            var positions = e.data;
                            letter_lis = $("#grid li").removeClass("lit");
                            $("#words li").removeClass("lit");
                            $(this).addClass("lit");
                            for(var j = 0; j < positions.length; j++) {
                                letter_lis.eq(positions[j]).addClass("lit");
                            }
                        })
                        .appendTo($("#words"));
                }
            });
        });
    });

    $("#reset").on("click", function() {
        $("#grid, #words").empty();
        for (i = 0; i < 16; i++) {
            $("<li>").appendTo($("#grid"));    
        }
        c.reset();
    });

});
