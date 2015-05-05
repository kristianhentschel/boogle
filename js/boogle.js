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
        $(video).hide();

        // capture current still frame to canvas
        
        // slice the canvas into the 16 grid points
        
        // send a thread off to try and recognise a single A-Z character in each slice
        // trying all rotations and taking the one with the highest confidence?

        // once all workers have finished, return the array.
        var letters = [];
        for(i = 0; i < 16; i++) {
            var letter = '?';

            letters.push(letter);
        }
        cb(letters);
    }

    function reset() {
        $(video).show();
        video.play();
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
