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
    var video   = document.getElementById("capture-video");
    var img     = document.getElementById("capture-img");
    var TESTING = true;

    function init(){
        if(TESTING) {
            $(video).hide();
            return;
        } else {
            $(img).hide();
        }

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

    // Capture the square crop of a video or image to a canvas of the same size 
    function capture_to_canvas(elem) {
        var canvas = document.createElement("canvas");
        
        // get the original dimensions
        var sw, sh;
        if(elem.tagName == "IMG") {
            sw = elem.naturalWidth;
            sh = elem.naturalHeight;
        } else if (elem.tagName == "VIDEO") {
            video.pause();
            sw = elem.videoWidth;
            sh = elem.videoHeight;
        } else {
            throw({name: "capture_to_canvas", message:"Expected VIDEO or IMG tag, got "+elem.tagName});
        }

        // dimensions and top left coordinates of square crop preview 
        var cw = Math.min(sw, sh); 
        var cx = (sw - cw)/2;
        var cy = (sh - cw)/2;
        canvas.width = cw;
        canvas.height = cw;

        var ctx = canvas.getContext("2d");
        ctx.drawImage(elem, cx, cy, cw, cw, 0, 0, cw, cw);

        return canvas;
    }

    function capture(cb) {
        var canvas;
        if (TESTING) {
            canvas = capture_to_canvas(img);
        } else {
            canvas = capture_to_canvas(video);
        }

        // recognise a single letter, uppercase ASCII only, black on white.
        var ocrad_options = {
            charset: 'ascii'
        }

        // prepare results array
        var letters = [];
        for(i = 0; i < 16; i++) {
            letters.push('?');
        }
        
        var real_letters = "TNTBGDARELTESISH";
        var correct_count = 0;

        // side of a single letter cell
        var lw = canvas.width / 4;

        // For each letter, crop the corresponding part of the still frame and try to recognize it.
        for(var i = 0; i < 4; i++) {
            for(var j = 0; j < 4; j++) {
                // create a new canvas for each letter
                var c = document.createElement("canvas");
                var ctx = c.getContext("2d");
                c.width = lw;
                c.height = lw;

                // copy the square for this grid cell to the new canvas
                ctx.drawImage(canvas, j * lw, i * lw, lw, lw, 0, 0, lw, lw);

                // try to adjust contrast, apply vignette, etc.
                prepare_ocr(ctx, lw);

                // TODO: rotation needs to be added before OCR step...
                // recognize a character string
                var result = OCRAD(ctx, ocrad_options);

                // correct common mismatches
                result = result.replace("l", "I");
                result = result.replace("|", "I");
                result = result.replace("1", "I");
                result = result.replace("0", "O");
                result = result.replace("°", "O");
                result = result.replace(" ", "");
                result = result.replace("_", "");
                result = result.toUpperCase();

                if (result == real_letters[4*i+j]) {
                    correct_count++;
                }
                letters[4*i + j] = result;

                // display the prepared image for debugging
                $("body").append(c);
            }
        }
        console.log("correct: "+correct_count+" of "+real_letters.length);

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
        var sample_distance = data.length / 100;

        for(var i = 0; i < data.length; i += sample_distance * 4) {
            var gray = (data[i] + data[i+1] + data[i+2]) / 3;
            white = Math.max(gray, white);
            black = Math.min(gray, black);
        }

        // convert to gray scale and apply black/white level adjustment
        for(var i = 0; i < data.length; i += 4) {
            var avg = (data[i] + data[i+1] + data[i+2]) / 3;
            var scaled = (1.0 * avg - black) / (white - black) * 255;
            data[i]   = scaled;
            data[i+1] = scaled;
            data[i+2] = scaled;
        }

        // find a circle enclosing the letter, but nothing else (a circle that has no black pixels)
        var c_max_r_iterations = 10;
        var c_offset = Math.round(Math.max(4, 0.2 * w));
        var c_step = Math.round(Math.max(1, 0.05 * w));

        var best_r = w/2;
        var best_cx = w/2;
        var best_cy = w/2;
        var best_sum = 0;

        var rmin = 0.2 * w;
        var rmax = 0.5 * w;

        var cos = [];
        var sin = [];
        for(var i = 0; i < 360; i += 10) {
            cos.push(Math.cos(2*Math.PI * i / 360));
            sin.push(Math.sin(2*Math.PI * i / 360));
        }

        for(var r = rmin; r < rmax; r += Math.max(1,(rmin - rmax)/c_max_r_iterations)) {
            for(var cx = w/2 - c_offset; cx < w/2 + c_offset; cx += c_step) { 
                for(var cy = w/2 - c_offset; cy < w/2 + c_offset; cy += c_step) { 
                    var sum = 0;
                    for(var i = 0; i < cos.length; i++) {
                        var x = Math.round(cx + r * cos[i]);
                        var y = Math.round(cy + r * sin[i]);
                        var luma = data[4 * (x + y * w)];
                        if ( luma > 200) {
                            sum += luma;
                        }
                        if (x < 0 || x > w || y < 0 || y > w) {
                            sum = 0;
                            break;
                        }
                    }
                    if (sum > best_sum) {
                        best_sum = sum;
                        best_cx = cx;
                        best_cy = cy;
                        best_r = r;
                    }
                }
            }
        }

        // apply the vignette with the given radius
        for(var x = 0; x < w; x++) {
            for(var y = 0; y < w; y++) {
                if ( Math.sqrt(Math.pow(best_cx - x, 2) + Math.pow(best_cy - y,2)) > best_r ) {
                    data[4 * (x + y * w)] = 255;
                    data[4 * (x + y * w) + 1] = 255;
                    data[4 * (x + y * w) + 2] = 255;
                }
            }
        }

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

    setTimeout(function(){$("#solve").trigger("click");}, 500);
});
