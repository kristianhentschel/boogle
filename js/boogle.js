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

    function solve(letters) {
        words = [];
        // generate all valid combinations of letters

        // filter out duplicates

        // filter out everything that's not a word
        return words;
    }


    // init
    make_dict();

    return {
        solve: solve
    };
}

function capture() {
    var video = document.getElementById("capture");

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
            $(video).hide();
            $("#words").text("No camera accessible (" + err.name + ": " + err.message + ").");
        });
    }
    
    function capture() {
        video.pause();

        return ['A'];
    }

    function reset() {
        $(video).show();
        video.play();

        $("#grid li").content();
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
    s = b.solve(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']);
    console.log();

    // test capture
    c = capture();
    c.init();

    // buttons
    $("#solve").on("click", function() { 
        letters = c.capture();
        $("#grid").empty();
        for (i = 0; i < letters.length; i++) {
            $("<li>").text(letters[i]).appendTo($("#grid"));    
        }

        results = s.solve(letters);
    });
    $("#reset").on("click", reset);

});
