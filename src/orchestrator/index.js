// Required Modules
const express = require('express');
const expressNunjucks = require('express-nunjucks');
const Consumer = require('sqs-consumer');
const hljs = require('highlight.js');
import {EventHandler} from '../lib/EventHandler';
import {HandlerStore} from '../lib/HandlerStore';
import {Utils} from '../lib/utils';
require('dotenv').config();
require('babel-polyfill');

// Init Event Handler
let handlers = new HandlerStore();
handlers.addHandler(new EventHandler('pull_request', function(eventData) {
    console.log('-----------------------------');
    console.log('New Event: ' + eventData.ghEventType);
    console.log('Repository Name: ' + eventData.repository.name);
    console.log('Pull Request: ' + eventData.pull_request.number);
}));

let pendingQueueHandler;
let systemConfig = {};
systemConfig.event = {};

// Setting up Instances
const app = express();
const isDev = process.env.ENVIRONMENT === 'development';

const bannerData = [
    ' #####  #     # #######                            ',
    '#     # #     # #       #    # ###### #    # ##### ',
    '#       #     # #       #    # #      ##   #   #   ',
    '#  #### ####### #####   #    # #####  # #  #   #   ',
    '#     # #     # #       #    # #      #  # #   #   ',
    '#     # #     # #        #  #  #      #   ##   #   ',
    ' #####  #     # #######   ##   ###### #    #   #   ',
    '###################################################'
];

// Configure Templates
app.set('views', __dirname + '/templates');

// Init Nunjucks
const njk = expressNunjucks(app, {
    watch: isDev,
    noCache: isDev
});

app.get('/', (req, res) => {
    res.render('index.html', {globalProperties: systemConfig});
});

app.get('/event_test/', (req, res) => {
    var event = Utils.samplePullRequestEvent();
    systemConfig.event.current = event;
    let result = handlers.handleEvent(event, systemConfig);
    if(result != true)
        console.log('Event was not Handled');
    else
        console.log('Event Handled');
    res.redirect(302, '/process/');
});

app.get('/process/', (req, res) => {
    let updatedEventData;
    if (systemConfig.event.current)
        updatedEventData = hljs.highlight('json', JSON.stringify(systemConfig.event.current, null, 4)).value;
    else
        updatedEventData = null;
    res.render('event.html', {globalProperties: systemConfig, eventData: updatedEventData});
});

app.use('/static', express.static(__dirname + '/static'));

Utils.getQueueUrlPromise(process.env.GTM_SQS_PENDING_QUEUE).then(function(data) {
    let pendingUrl = data;
    systemConfig.pendingQueue = {};
    systemConfig.pendingQueue.url = pendingUrl;

    pendingQueueHandler = Consumer.create({
        queueUrl: pendingUrl,
        region: 'ap-southeast-2',
        messageAttributeNames: ['ghEventType'],
        handleMessage: (message, done) => {
            console.log('Received Event from Queue');
            console.debug(message);
            console.debug('JSON Parse');
            console.debug(JSON.parse(message.Body));
            let ghEvent;
            try {
                ghEvent = message.MessageAttributes.ghEventType.StringValue;
            } catch (TypeError) {
                console.log('No Message Attribute \'ghEventType\' in Message. Defaulting to \'status\'');
                ghEvent = 'status';
            }
            let messageBody = JSON.parse(message.Body);
            messageBody.ghEventType = ghEvent;
            systemConfig.event.current = messageBody;
            let result = handlers.handleEvent(messageBody, systemConfig);
            if(result != true)
                console.log('Event was not Handled');
            else
                console.log('Event Handled');
            done();
        }
    });

    pendingQueueHandler.on('error', (err) => {
        console.log('ERROR In SQS Queue Handler');
        console.log(err.message);
    });

    pendingQueueHandler.on('stopped', () => {
        console.log('Queue Processing Stopped');
        systemConfig.pendingQueue.state = 'Stopped';
    });
    
    pendingQueueHandler.start();
    systemConfig.pendingQueue.state = 'Running';

    bannerData.forEach(function(line) {
        console.log(line);
    });

    app.listen(process.env.PORT, function() {
        console.log('GitHub Event Orchestrator Running on Port ' + process.env.PORT);
        console.log('Runmode: ' + process.env.ENVIRONMENT);
        console.log('AWS Access Key ID: ' + Utils.maskString(process.env.AWS_ACCESS_KEY_ID));
        console.log('AWS Access Key: ' + Utils.maskString(process.env.AWS_SECRET_ACCESS_KEY));
        console.log('Pending Queue URL: ' + pendingUrl);
        console.debug(njk.env);
    });
});