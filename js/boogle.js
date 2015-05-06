function boogle(msg) {
    var dict = {};
    var min_length = 3;

    function make_dict(dict_path){
        $.get(dict_path, function(data) {
            var words = data.split("\n");
            words = _.map(words, function(s) { return s.trim(); });
            words = _.filter(words, function(s) { return s.length > 0;});
            trie_build(dict, words);
        });
    }
    
    // a word in the trie is valid, if there is a path from the top to its final letter
    // and the final letter has is_word == true.

    function trie_build(t, words){
        t.is_word = false;
        _.each(words, function(word) {
            trie_insert(t, word);
        });
    }

    function trie_insert(t, w) {
        if (w.length == 0) {
            t.is_word = true;
            return;
        }

        if(!(w[0] in t)) {
            t[w[0]] = {is_word:false};
        }

        trie_insert(t[w[0]], w.slice(1));
    }


    // we use a bit field to keep track of the letters we have visited for this branch of the search tree.
    function mark(state, x, y) {
        return state | (1 << coord_to_pos(x, y));
    }

    function seen(state, x, y) {
        return (state & (1 << coord_to_pos(x, y))) != 0;
    }

    function unseen_neighbours(state, cx, cy) {
        neighbours = [];
        for(i = -1; i <= 1; i++) {
            for(j = -1; j <= 1; j++) {
                var x = cx + i;
                var y = cy + j;
                if (x == cx && y == cy) continue;
                if (x < 0 || x > 3) continue;
                if (y < 0 || y > 3) continue;
                if (seen(state, x, y)) continue;

                neighbours.push({x: x, y: y});
            }
        }
        return neighbours;
    }

    function coord_to_pos(x, y) {
        return x + y * 4;
    }

    function letter_at(letters, x, y) {
        return letters[coord_to_pos(x, y)];
    }

    // words: the accumulator array
    // letters: the row-major grid of available letters (constant)
    // state: a bit field with all positions (those contributing to partial) marked.
    // partial: a character array of all characters seen so far.
    // trie: the trie node corresponding to the current state, it has all branches that could follow partial.
    // x, y: the current position in the grid.
    function recursive_solve(words, letters, state, partial, trie, x, y) {
        if(trie.is_word) {
            words.push({word: partial, state: state}); 
        }
        
        var neighbours = unseen_neighbours(state, x, y);
        //console.log([partial, x, y, state, neighbours, trie]);
        for(var i = 0; i < neighbours.length; i++) {
            var next_x = neighbours[i].x;
            var next_y = neighbours[i].y;
            var next_letter = letter_at(letters, next_x, next_y);
            if(next_letter in trie) {
                recursive_solve(words, letters,
                        mark(state, next_x, next_y),
                        partial + next_letter,
                        trie[next_letter],
                        next_x, next_y);
            }
        }
    }

    function solve(letters, cb) {
        var words = [];

        letters = _.map(letters, function(s){return s.toLowerCase();});

        // for each start position, use recursion to explore search space.
        for(var y = 0; y < 4; y++) {
            for(var x = 0; x < 4; x++) {
                var letter = letter_at(letters, y, x);
                if (letter in dict) {
                    recursive_solve(words, letters, mark(0, y, x), letter, dict[letter], y, x);
                }
            }
        }

        // sort by length and then alphabetically
        words = _.sortBy(words, function(w) {
            return "_".repeat(w.word.length) + w.word;
        });

        // convert states to list of indices
        words = _.each(words, function(w) {
            w.positions = [];
            for(var i = 0; i < 16; i++) {
                if (w.state & (1 << i)) {
                    w.positions.push(i);
                }
            }
        });

        // filter out duplicate words
        words = _.uniq(words, false, function(w) {
            return w.word;
        });


        // filter out short words
        words = _.filter(words, function(w) { return w.word.length >= min_length; });

        // finally, give resulting array to the callback
        cb(words);
    }

    return {
        init: make_dict,
        solve: solve
    };
}

function capture(msg) {
    var video   = document.getElementById("capture-video");
    var img     = document.getElementById("capture-img");
    var TESTING = false;

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
        var constraints = {
            audio:false,
            video:{}
        };

        if(MediaStreamTrack.getSources != undefined) {
            MediaStreamTrack.getSources(function(sources){
                selectedId = null;
                for(var i = 0; i < sources.length; i++) {
                    if(sources[i].kind == "video" && sources[i].facing == "environment") {
                        selectedId = sources[i].id;
                    }
                }
                if (selectedId != null) {
                    constraints.video.optional = [{sourceId: selectedId}];
                }
                connect();
            });
        } else {
            connect();
        }

        function connect() {
            navigator.mediaDevices.getUserMedia(constraints)
            .then(function(stream) {
                video.src = window.URL.createObjectURL(stream);
                video.onloadedmetadata = function(e) {
                    video.play();
                };
            })
            .catch(function(err) {
                msg.setStatus("No camera accessible (" + err.name + ": " + err.message + ").");
                $("#main, #buttons").hide();
            });
        }
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
                result = result.replace("\n", "");
                result = result.replace("Ou", "Qu");
                result = result.toUpperCase();

                letters[4*i + j] = result;

                // display the prepared image for debugging
                $("body").append(c);
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

    // allows some ui access to models
    msg = {
        setStatus: function(message) {
            $("#status").text(message).show();
        },
        clearStatus: function() {
            $("#status").empty().hide();
        }
    };

    $("#buttons").hide();

    // promises could be used to wait for both initialisations to finish before starting the UI.
    //var promises = [];

    // initiate solver and load dictionary
    msg.setStatus("Initialising dictionary");
    b = boogle(msg);
    b.init("words/enable1.txt");

    // capture
    msg.setStatus("Requesting to access the camera");
    c = capture(msg);
    c.init();

    // all initialised, let the user play
    function startUI() {
        msg.clearStatus();
        $("#buttons").show();
        // buttons and UI
        $("#solve").on("click", function() { 
            // recognize letters
            msg.setStatus("Processing captured image");
            c.capture(function(letters){
                // display recognized letters
                $("#grid").empty().addClass("static");
                for (var i = 0; i < letters.length; i++) {
                    $("<li>").text(letters[i]).appendTo($("#grid"));    
                }

                // find all words in the grid
                msg.setStatus("Solving the puzzle");
                results = b.solve(letters, function(words) {
                    // display found words
                    $("#words").empty();

                    for(var i = 0; i < words.length; i++) {
                        var len = words[i].word.length;
                        //if(len > 8) len = 8;

                        $("<li>")
                            .text(words[i].word)
                            .addClass("word-length-" + len)
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
                    msg.clearStatus();
                });
            });
        });

        $("#reset").on("click", function() {
            $("#grid, #words").removeClass("static").empty();
            for (i = 0; i < 16; i++) {
                $("<li>").appendTo($("#grid"));    
            }
            c.reset();
        });

    }

    startUI();
});
