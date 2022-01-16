if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const ACCESS_ID = 'AKIAT5JFKSHVHOGYQJGG';
const SECRET_KEY = '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';

const crypto = require('crypto');
const express = require('express');
const proxy = require('http-proxy-middleware');
const v4 = require('./lib/aws-signature-v4'); // to generate our pre-signed URL

let region = 'us-west-2';
let languageCode = 'en-US';
let sampleRate = 44100;

let proxyRouter = function (req) {
    return createPresignedUrl();
}

var proxyFilter = function(pathname, req) {
    return pathname.match('^/ws') && req.method === 'GET'
  }

let wsProxy = proxy(proxyFilter, {
    target: createPresignedUrl(),
    ws: true, // enable websocket proxy
    logLevel: 'debug',
    changeOrigin: true,
    pathRewrite: {
        '^/ws': '' // remove path.
    },

    router: proxyRouter, //generate a fresh pre-signed URL for each connection

    onError: function(err, req, res) {
        console.log(err)
    
        res.end(err);
    }
});

const app = express();
app.use(express.static('public'));
app.use('/css',express.static(__dirname + '/css'));
app.use('/fontawesome',express.static(__dirname + '/fontawesome'));
app.use('/img',express.static(__dirname + '/img'));
app.use('/js',express.static(__dirname + '/js'));
app.use('/lib',express.static(__dirname + '/lib'));

app.use(wsProxy); // add the proxy to express

const server = app.listen(process.env.PORT || 5001);
server.on('upgrade', wsProxy.upgrade);

app.get('/', function (request, response) {
    console.log(__dirname + 'index.html')
    response.sendFile(__dirname + '/index.html');
});

app.get('/stop', function (request, response) {});

app.get('/region/:region', function (request, response) {
    region = 'us-west-2';
    response.sendStatus(200);
});

app.get('/language/:languageCode', function (request, response) {

    languageCode=="en-US"
    sampleRate = 44100


    response.sendStatus(200);
});

function createPresignedUrl() {
    let query = "language-code=" + languageCode + "&media-encoding=pcm&sample-rate=" + sampleRate;

    let endpoint = "transcribestreaming." + region + ".amazonaws.com:8443";

    // get a preauthenticated URL that we can use to establish our WebSocket
    return v4.createPresignedURL(
        'GET',
        endpoint,
        '/stream-transcription-websocket',
        'transcribe',
        crypto.createHash('sha256').update('', 'utf8').digest('hex'), {
            'key': ACCESS_ID,
            'secret': SECRET_KEY,
            'protocol': 'wss',
            'expires': 15,
            'region': region,
            'query': query
        }
    );
}