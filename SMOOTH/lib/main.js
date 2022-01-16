const audioUtils = require('./audioUtils'); // for encoding audio data as PCM
const marshaller = require("@aws-sdk/eventstream-marshaller"); // for converting binary event stream messages to and from JSON
const util_utf8_node = require("@aws-sdk/util-utf8-node"); // utilities for encoding and decoding UTF8
const mic = require('microphone-stream'); // collect microphone input as a stream of raw bytes

// our converter between binary event streams messages and JSON
const eventStreamMarshaller = new marshaller.EventStreamMarshaller(util_utf8_node.toUtf8, util_utf8_node.fromUtf8);

// our global variables for managing state
let languageCode;
let region;
let sampleRate;
let transcription = "";
let raw = "";
let score = 0;
let socket;
let micStream;
let socketError = false;
let transcribeException = false;
let filler_count = 0;
let wordCount = 0;

$(document).ready(function () {
    // check to see if the browser allows mic access
    if (!window.navigator.mediaDevices.getUserMedia) {
        // Use our helper method to show an error on the page
        showError('We support the latest versions of Chrome, Firefox, Safari, and Edge. Update your browser and try your request again.');

        // maintain enabled/distabled state for the start and stop buttons
        toggleStartStop();
    }
});

$('#start-button').click(function () {
    $('#error').hide(); // hide any existing errors
    toggleStartStop(true); // disable start and enable stop button

    // set the language and region from the dropdowns
    setLanguage();
    setRegion();
    // first we get the microphone input from the browser (as a promise)...
    window.navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
        })
        // ...then we convert the mic stream to binary event stream messages when the promise resolves 
        .then(streamAudioToWebSocket)
        .catch(function (error) {
            showError('There was an error streaming your audio to Amazon Transcribe. Please try again.');
            console.error(error);
            toggleStartStop();
        });
});

let streamAudioToWebSocket = function (userMediaStream) {
    //let's get the mic input from the browser, via the microphone-stream module
    micStream = new mic();
    micStream.setStream(userMediaStream);

    let url = window.location.href.replace("https://", "wss://")
    url = url.replace("http://", "ws://")
    url = url + 'ws';

    //open up our WebSocket connection
    socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";

    // when we get audio data from the mic, send it to the WebSocket if possible
    socket.onopen = function () {
        micStream.on('data', function (rawAudioChunk) {
            // the audio stream is raw audio bytes. Transcribe expects PCM with additional metadata, encoded as binary
            let binary = convertAudioToBinaryMessage(rawAudioChunk);

            if (socket.OPEN)
                socket.send(binary);
        })
    };

    // handle messages, errors, and close events
    wireSocketEvents();
}

function setLanguage() {
    languageCode = "en-US";
    sampleRate = 44100;
    //send the value to the server
    $.get("/language/" + languageCode);
}

function setRegion() {
    region = "us-west-1"

    //send the value to the server
    $.get("/region/" + region);
}

function wireSocketEvents() {
    // handle inbound messages from Amazon Transcribe
    socket.onmessage = function (message) {
        //convert the binary event stream message to JSON
        let messageWrapper = eventStreamMarshaller.unmarshall(Buffer(message.data));
        let messageBody = JSON.parse(String.fromCharCode.apply(String, messageWrapper.body));
        if (messageWrapper.headers[":message-type"].value === "event") {
            handleEventStreamMessage(messageBody);
        } else {
            transcribeException = true;
            showError(messageBody.Message);
            toggleStartStop();
        }
    };

    socket.onerror = function () {
        socketError = true;
        showError('WebSocket connection error. Try again.');
        toggleStartStop();
    };

    socket.onclose = function (closeEvent) {
        micStream.stop();

        // the close event immediately follows the error event; only handle one.
        if (!socketError && !transcribeException) {
            if (closeEvent.code != 1000) {
                showError('</i><strong>Streaming Exception</strong><br>' + closeEvent.reason);
            }
            toggleStartStop();
        }
    };
}

let handleEventStreamMessage = function (messageJson) {
    let results = messageJson.Transcript.Results;

    if (results.length > 0) {
        if (results[0].Alternatives.length > 0) {
          var transcript = results[0].Alternatives[0].Transcript; // fix encoding for accented characters
    
          transcript = decodeURIComponent(escape(transcript)); // update the textarea with the latest result
          
          // console.log(transcript);
          var word1 = "actually";
          var word2 = "like";
          var word3 = "um";
          var word4 = "uh";
          var word5 = " ah";
          var word6 = "i mean";
          var word7 = "hm";
          
          var word9 = "you know";
          var word10 = "basically";
          var word11 = "right";
          var word12 = "well";
    
          var wordContent;
    
          wordContent = transcript
            .toLowerCase()
            .replaceAll(
              word1,
              "<span style='color:red'>" + word1 + "</span>"
            )
            .replaceAll(
              word2,
              "<span style='color:red'>" + word2 + "</span>"
            )
            .replaceAll(
              word3,
              "<span style='color:red'>" + word3 + "</span>"
            )
            .replaceAll(
              word4,
              "<span style='color:red'>" + word4 + "</span>"
            )
            .replaceAll(
              word5,
              "<span style='color:red'> " + word5 + "</span>"
            )
            .replaceAll(
              word6,
              "<span style='color:red'>" + word6 + "</span>"
            )
            .replaceAll(
              word7,
              "<span style='color:red'>" + word7 + "</span>"
            )
            .replaceAll(
              word9,
              "<span style='color:red'>" + word9 + "</span>"
            )
            .replaceAll(
              word10,
              "<span style='color:red'>" + word10 + "</span>"
            )
            .replaceAll(
              word11,
              "<span style='color:red'>" + word11 + "</span>"
            )
            .replaceAll(
              word12,
              "<span style='color:red'>" + word12 + "</span>"
            );
    
          document.getElementById("transcript").innerHTML =
            transcription + wordContent;
            if (!results[0].IsPartial) {
                //scroll the textarea down
                document.getElementById("transcript").innerHTML =
                transcription + wordContent;
                transcription += wordContent;
                raw += transcript + " "

                let um_count = (transcription.match(/um/gi) || []).length
                $('#um').text(um_count)

                let uh_count = (transcription.match(/uh/gi) || []).length
                $('#uh').text(uh_count)

                let like_count = (transcription.match(/like/gi) || []).length
                $('#like').text(like_count)

                let ah_count = (transcription.match(/ah/gi) || []).length
                $('#ah').text(ah_count)

                let hm_count = (transcription.match(/hm/gi) || []).length
                $('#hm').text(hm_count)

                let you_know_count = (transcription.match(/you know/gi) || []).length
                $('#you_know').text(you_know_count)

                let actually_count = (transcription.match(/actually/gi) || []).length
                $('#actually').text(actually_count)

                let well_count = (transcription.match(/well/gi) || []).length
                $('#well').text(well_count)

                let right_count = (transcription.match(/right/gi) || []).length
                $('#right').text(right_count)

                let basically_count = (transcription.match(/basically/gi) || []).length
                $('#basically').text(basically_count)

                let i_mean_count = (transcription.match(/i mean/gi) || []).length
                $('#i_mean').text(i_mean_count)

                filler_count = um_count + uh_count + like_count + ah_count + hm_count + you_know_count + i_mean_count +
                basically_count + right_count + well_count + actually_count
                $('#filler_count').text(filler_count)

                // let actually_count = (transcription.match(/actually/gi) || []).length
                // $('#actually').text(actually_count)

                // let well_count = (transcription.match(/well/gi) || []).length
                // $('#well').text(well_count)

                // let i_mean_count = (transcription.match(/I mean/gi) || []).length
                // $('#i_mean').text(i_mean_count)
            }
        }
    }
}

let closeSocket = function () {
    if (socket.OPEN) {
        micStream.stop();

        // Send an empty frame so that Transcribe initiates a closure of the WebSocket after submitting all transcripts
        let emptyMessage = getAudioEventMessage(Buffer.from(new Buffer([])));
        let emptyBuffer = eventStreamMarshaller.marshall(emptyMessage);
        socket.send(emptyBuffer);
        socket.close();
    }
}

var totalCount = function totalCount() {
    console.log(raw.split(" "));
    wordCount = raw.split(" ").length - 1; // Compensate for empty space
  
    document.getElementById("wordCount").innerHTML = wordCount;
  }

var totalScore = function totalScore() {
    score = filler_count / wordCount;
    if (score < 0.05) {
        document.getElementById("totalScore").innerHTML = "Excellent!";
    } else if (0.05 < score < 0.1) {
        document.getElementById("totalScore").innerHTML = "Great Job!";
    } else if (0.1 < score < 0.2) {
        document.getElementById("totalScore").innerHTML = "Good Job!";
    } else {
        document.getElementById("totalScore").innerHTML = "Needs improvement...";
    }
}

$('#stop-button').click(function () {
    closeSocket();
    toggleStartStop();
    totalCount();
    totalScore();
});

$('#reset-button').click(function () {
    document.getElementById("totalScore").innerHTML = " ";
    transcription = ''; 
    filler_count = 0;
    wordCount = 0;
    document.getElementById("transcript").innerHTML = transcription;
    $('#filler_count').text(filler_count)
    document.getElementById("wordCount").innerHTML = wordCount;
    let um_count = (transcription.match(/um/gi) || []).length
    $('#um').text(um_count)

    let uh_count = (transcription.match(/uh/gi) || []).length
    $('#uh').text(uh_count)

    let like_count = (transcription.match(/like/gi) || []).length
    $('#like').text(like_count)

    let ah_count = (transcription.match(/ah/gi) || []).length
    $('#ah').text(ah_count)

    let hm_count = (transcription.match(/hm/gi) || []).length
    $('#hm').text(hm_count)

    let you_know_count = (transcription.match(/you know/gi) || []).length
    $('#you_know').text(you_know_count)

    let actually_count = (transcription.match(/um/gi) || []).length
    $('#actually').text(actually_count)

    let well_count = (transcription.match(/um/gi) || []).length
    $('#well').text(well_count)

    let right_count = (transcription.match(/um/gi) || []).length
    $('#right').text(right_count)

    let basically_count = (transcription.match(/um/gi) || []).length
    $('#basically').text(basically_count)

    let i_mean_count = (transcription.match(/um/gi) || []).length
    $('#i_mean').text(i_mean_count)
});

function toggleStartStop(disableStart = false) {
    $('#start-button').prop('disabled', disableStart);
    $('#stop-button').attr("disabled", !disableStart);
}

function showError(message) {
    $('#error').html('<i class="fa fa-times-circle"></i> ' + message);
    $('#error').show();
}

function convertAudioToBinaryMessage(audioChunk) {
    let raw = mic.toRaw(audioChunk);

    if (raw == null)
        return;

    // downsample and convert the raw audio bytes to PCM
    let downsampledBuffer = audioUtils.downsampleBuffer(raw, sampleRate);
    let pcmEncodedBuffer = audioUtils.pcmEncode(downsampledBuffer);

    // add the right JSON headers and structure to the message
    let audioEventMessage = getAudioEventMessage(Buffer.from(pcmEncodedBuffer));

    //convert the JSON object + headers into a binary event stream message
    let binary = eventStreamMarshaller.marshall(audioEventMessage);

    return binary;
}

function getAudioEventMessage(buffer) {
    // wrap the audio data in a JSON envelope
    return {
        headers: {
            ':message-type': {
                type: 'string',
                value: 'event'
            },
            ':event-type': {
                type: 'string',
                value: 'AudioEvent'
            }
        },
        body: buffer
    };
}