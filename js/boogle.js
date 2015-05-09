// boogle-solve
// options = {
//      dict_path: "text1.txt", //mandatory path to dictionary file
// }
function boogle(options) {
    var dict = {};
    var min_length = 3;

    function init(){
        var promise = new Promise(function(y, n) {
            $.ajax(options.dict_path, {
                // keep the promise:
                success: y,
                // break the promise and return an error
                error: function(result){
                    n({name:result.statusText, msg:"Could not load dictionary."});
                }
            });
        });

        return promise.then(function(data) {
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

        var letter = w[0];
        var w_tail = w.slice(1);
        if(letter == "q" && w.length > 1 && w[1] == "u") {
            letter = "qu";
            w_tail = w.slice(2);
        }

        if(!(letter in t)) {
            t[letter] = {is_word:false};
        }

        trie_insert(t[letter], w_tail);
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

    function solve(letters) {
        var promise = new Promise(function(promise_y,promise_n){
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

            // finally, give resulting array to the callback (fulfil the promise)
            promise_y(words);
        });
        return promise;
    }

    return {
        init: init,
        solve: solve
    };
}

function capture(msg) {
    var video   = document.getElementById("capture-video");
    var img     = document.getElementById("capture-img");
    var user_settings = {
        save_img: false,
        show_processed: false,
        static_img: false //TODO may not be needed/there may be a better way of expressing this.
    }

    function init(){
        if(user_settings.static_img) {
            return Promise.resolve({name: "capture.init", msg: "testing mode, no need to try the video."});
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
            return new Promise(function(y,n){
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
                    
                    // fulfils the promise with the result of connect, another Promise.
                    y(connect());
                });
            });
        } else {
            return connect();
        }

        function connect() {
            var promise = navigator.mediaDevices.getUserMedia(constraints);
            return promise.then(function(stream) {
                return window.URL.createObjectURL(stream);
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
            throw({name: "capture_to_canvas", msg:"Expected VIDEO or IMG tag, got "+elem.tagName});
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

    function capture() {
        var promise = new Promise(function(y,n){
            var canvas;

            try {
                if (user_settings.static_img) {
                    canvas = capture_to_canvas(img);
                } else {
                    canvas = capture_to_canvas(video);
                }
            } catch(err) {
                console.log("error in capture_to_canvas", err);
                n(err);
                return;
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
            var promises = [];
            for(var i = 0; i < 4; i++) {
                for(var j = 0; j < 4; j++) {
                    var promise = new Promise(function(y,n) {
                        // create a new canvas for each letter
                        var c = document.createElement("canvas");
                        var ctx = c.getContext("2d");
                        c.width = lw;
                        c.height = lw;

                        // copy the square for this grid cell to the new canvas
                        ctx.drawImage(canvas, j * lw, i * lw, lw, lw, 0, 0, lw, lw);

                        // try to adjust contrast, apply vignette, etc.
                        // TODO prepare ocr is still synchronous even if ocrad isn't.
                        prepare_ocr(ctx, lw);
                        console.log("prepare_ocr done for ", i, j);
                        if (user_settings.show_processed) {
                            $(c).appendTo($("body"));
                        }

                        // TODO: rotation needs to be added before OCR step...

                        // recognize a character string
                        // use OCRAD with an asynchronous callback as a promise so we can move on?
                            OCRAD(ctx, ocrad_options, function(result){y(result)});
                    });
                    promises.push(promise);
                }
            }

            // correct common mismatches once all promises have returned
            Promise.all(promises).then(function(results) {
                console.log("all OCRAD promises fulfilled.");
                for(var i = 0; i < results.length; i++) {
                    var result = results[i];
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

                    if (result.length == '0'){
                        result = '?';
                    } else if (result[0] == 'Q') {
                        result = "Qu";
                    } else {
                        result = result[0];
                    }
                    letters[i] = result; 
                }
                // fulfil the promise with our result
                y(letters);
            }).catch(function(err){
                // some error occured in one of the OCRAD promises?
                n(err);
            });

            // start a download of the image if enabled
            if (user_settings.save_img) {
                $("<a>")
                    .attr("download", "boogle_"+new Date().getTime()+"_"+btoa(letters.join()))
                    .attr("href", canvas.toDataURL("image/png"))
                    .text("captured image")
                    .get(0).click();
            }

        });
        console.log("returning capture promise");
        return promise;
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

        white = Math.max(black + 1, white * .75);
        black = Math.min(1.25 * black, white - 1);
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
                        var x1 = Math.round(cx + r * cos[i]);
                        var y1 = Math.round(cy + r * sin[i]);
                        var luma = data[4 * (x + y * w)];
                        if ( luma > 200) {
                            sum += 1;//luma;
                        }
                        if ( luma < 10) {
                            sum -= 1;
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
        reset: reset,
        setShowProcessed: function(val) { user_settings.show_processed = !!val; },
        setSaveImg: function(val) { user_settings.save_img = !!val; },
        setStaticImg: function(val) { user_settings.static_img = !!val; }
    };
}

// The UI is the master driver for this app, it initialises the solver and ocr capture modules.
// options = {
//      solve: boogle({}),      // optional solver instance
//      capture: capture({}),   // optional capture instance
// }
function boogle_ui(options) {
    var status  = $("#status");
    var main    = $("#main");
    var grid    = $("#grid");
    var video   = $("#capture-video");
    var buttons = $("#buttons");
    var words   = $("#words");

    var enum_capture = 0;
    var enum_display = 1;

    var state = {
        init: false,
        options: {},
        solve: null,
        capture: null,
        letters: [],
        solution: [],
        camera_ready: false,
        ui_ready: false,
        buttons_enabled: false,
        mode: enum_capture
    }

    if (options != undefined) {
        state.options = options;
    }
    
    // === Private Methods ===
    function setStatus(message) {
        status.text(message).show();
    }

    function clearStatus() {
        status.text("").hide();
    }

    function disable_ui() {
        state.buttons_enabled = false;
        buttons.addClass("disabled");
        console.log("disable_ui");
    }

    function enable_ui() {
        state.buttons_enabled = true;
        buttons.removeClass("disabled");
        console.log("enable_ui");
    }

    // clears the letters grid.
    // displays letters.
    // registers event handlers for corrections.
    function display_letters() {
        var letters = state.letters;
        $("#grid").empty().addClass("static");
        for (var i = 0; i < letters.length; i++) {
            $("<li>")
                .text(letters[i])
                .bind("click", {pos: i, letter: letters[i]}, btn_correct)
                .appendTo($("#grid"));
        }
    }

    // clears the words list.
    // displays words.
    // registers event handlers for highlighting.
    function display_words() {
        words.empty();

        for(var i = 0; i < state.words.length; i++) {
            var word = state.words[i];
            var len = word.word.length;

            $("<li>")
                .text(word.word)
                .addClass("word-length-" + len)
                .on("click mouseover", {positions: word.positions}, function(e){
                    highlight($(this), e.data.positions);
                })
                .appendTo(words);
        }
    }

    // highlights the given word element and all letters identified by positions.
    // word is a jQuery-wrapped DOM element
    // positions is an array of letter positions [0,1,...15].
    function highlight(word, positions){
        console.log(word);

        var letter_lis  = grid.children("li");
        var word_lis    = words.children("li");

        word_lis.removeClass("lit");
        letter_lis.removeClass("lit");

        for(var j = 0; j < positions.length; j++) {
            letter_lis.eq(positions[j]).addClass("lit");
        }
        word.addClass("lit");
    }

    // asynchronously:
    // captures an image.
    // disables the ui.
    // recognizes the letters.
    // displays the letters.
    // calls do_solve, which eventually re-enables the UI.
    function do_capture() {
        disable_ui();
        setStatus("Processing the image and recognizing characters.");
        
        var promise = state.capture.capture();

        return promise.then(function(result) {
            clearStatus();
            state.letters = result;
            display_letters();
        }).catch(function(err){
            setStatus("Image processing failed. " + err.name);
        }).then(do_solve);
    }

    // asynchronously:
    // disables the ui.
    // solves the current set of letters.
    // displays the words.
    // enables the ui.
    function do_solve() {
        disable_ui();
        setStatus("Solving the puzzle.");
        var promise = state.solve.solve(state.letters);

        return promise.then(function(result){
            state.words = result;
            clearStatus();
            display_words();
            enable_ui();
        }).catch(function(err){
            console.log(err);
            setStatus("Puzzle solving failed. " + err.name);
        });
    }

    // asynchronously:
    // updates the letter.
    // displays the new letters.
    // calls do_solve.
    function do_correct(pos, letter) {
        console.log("do_correct:", letter);
        state.letters[pos] = letter;
        display_letters();
        do_solve();
    }

    // clears the state and removes UI elements from previous solutions.
    // returns to capture mode.
    // resets the static-image flag in capture object in case the last request used it.
    function do_reset() {
        state.mode = enum_capture;
        state.letters = [];
        state.words = [];
        grid.empty().removeClass("static");
        for(var i = 0; i < 16; i ++) {
            grid.append($("<li>"));
        }
        words.empty();

        $("#capture-img").hide();
        $("#capture-video").show();
        state.capture.setStaticImg(false);

        video.get(0).play();
    }

    // === Event Handlers ===
    // A grid cell was clicked, show a UI element to allow correction of its letter.
    function btn_correct(e) {
        if (!state.buttons_enabled) return;
        var pos = e.data.pos;
        console.log("btn_correct: pos = ", pos);

        // TODO: A better UI element than this ;)
        var letter = window.prompt("Correct letter:", e.data.letter);
        if (letter != null && letter != "") {
            letter = letter[0].toUpperCase();
            if (letter == "Q")
                letter = "Qu";

            console.log(pos, letter);
            do_correct(pos, letter);
        }
    }

    // The solve button was clicked, capture the image and start the solver.
    // Alternatively, if we are in display mode, just solve again with corrections.
    function btn_solve() {
        console.log("btn_solve");
        if (!state.buttons_enabled) return;

        if (state.mode == enum_capture) {
            do_capture(); //includes do_solve.
        } else {
            do_solve();
        }
    }

    // The reset button was clicked, go back to image capture mode.
    function btn_reset() {
        if (!state.buttons_enabled) return;
        console.log("btn_reset");
        do_reset();
    }

    // Toggle the save-images setting
    // set the corresponding field in the capture object.
    function change_save_img(e) {
        state.capture.setSaveImg(this.checked);
    }

    // Toggle the show-processed-image setting
    // set the corresponding field in the capture object.
    function change_show_processed(e) {
        state.capture.setShowProcessed(this.checked);
    }

    // Choose a file for manual input
    // set the file processing flag and display the image file (solve button will take care of the rest)
    function change_file_input(e) {
        // Reset, in case a previous solution is currently shown
        do_reset();

        // Load the selected image file into the DOM
        var img = document.getElementById("capture-img");
        var file = this.files[0];
        var url = window.URL.createObjectURL(file);
        img.src = url;

        // show the image and set the flag for capture
        $("#capture-img").show();
        $("#capture-video").hide();
        state.capture.setStaticImg(true);
    }

    // attach the main UI events
    function initEvents() {
        buttons.children("#solve").on("click", btn_solve);
        buttons.children("#reset").on("click", btn_reset);

        $("#setting_save_img").on("change", change_save_img).get(0).checked = false;
        $("#setting_show_processed").on("change", change_show_processed).get(0).checked = false;
        $("#setting_file_input").on("change", change_file_input);
    }

    // === Public Methods ===
    // initialises the UI and initialises the other components.
    function init() {
        // only initialise once!
        if (state.init) return;
        state.init = true;

        // disable UI interactions until initialisation is completed.
        disable_ui();
   
        // instantiate solve
        if (state.options.solve) {
           state.solve = state.options.solve;
        } else {
           state.solve = boogle({dict_path: "words/enable1.txt"});
        }

        // instantiate capture
        if (state.options.capture) {
            state.capture = state.options.capture;
        } else {
            state.capture = capture();
        }

        // attach events
        initEvents();

        // initialise the solver and capture objects, which can take quite some time.
        setStatus("Initialising camera capture and solver dictionary.");
        var promise_capture = state.capture.init();
        var promise_solve   = state.solve.init();

        Promise.all([promise_capture, promise_solve])
            .then(function(results) {
                console.log("ui.init then results:", results);

                // deal with results from promise_capture
                capture_result = results[0];
                var v = video.get(0);
                v.src = capture_result;
                v.onloadedmetadata = function(e) {
                    v.play();
                };

                // hide place holder image
                $("#capture-img").hide();

                // deal with results from promise_solve
                // solve_result = results[1];

                // everything done
                state.ui_ready = true;
                enable_ui();
                clearStatus();
            })
            .catch(function(err) {
                setStatus("Could not initialise: "+err.name);
            });

        // Debugging
        console.log(this);
        console.log(state);
    }

    return {
        init: init,
        state: state
    };
}

// --------------------------------------------------
// *** Initialise everything on document.ready(). ***
// --------------------------------------------------
$(function() {
    // start the application with default options for now
    var the_ui = boogle_ui();
    the_ui.init();
});
