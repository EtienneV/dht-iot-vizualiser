'use strict'

const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('request')

app.set('port', (process.env.PORT || 5000))
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

var DHT_IOT = require('dht-iot')
var keypair = {publicKey:Buffer.from("6ef441733b1510cc5c93b7201e256b1d9605825e4ea0caca8e202193be090da4", 'hex'),
secretKey:Buffer.from("6809e0b94f41b1d72cbe29e433e488e1682c703f0ea6a2b5e8bb8a2e74bbf16811759cd5477a8f10b4d73e1f76aaaec81ea201d60ad0358e749c4d3426f5901a", 'hex')}
var dht_iot = new DHT_IOT({keypair: keypair})

/**
 * Render engine configuration
 */
 app.set('views', __dirname + '/');
 app.engine('ejs', require('ejs').renderFile);
 app.set('view engine', 'ejs');

 app.use(express.static(__dirname + '/'));

// Spin up the server
var server = app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'))
})

var io = require('socket.io').listen(server);

var lat;
var lasttime = 0;

/**
* Routes
**/ 

// Racine
app.get('/', function (req, res) {
  res.render('page_racine', {});
})

io.on('connection', function(socket){
  console.log('A user connected');

  dht_iot.get_notified()

  dht_iot.on('new_value', function (hash, data) {
    lat = 0;
    console.log(data.value+" - "+data.timestamp)
    if ((Date.now()/1000 - data.timestamp <= 7200) && (data.timestamp > lasttime))
    {
     socket.emit('new_temp', {
      time: data.timestamp,
      temp: data.value
    });
     lat = 1;
     lasttime = data.timestamp;
   }
 })


  dht_iot.on('get_nodes', function (nodes) {
    console.log("Nodes : ")
    console.log(nodes)

    for(var i = 0; i < nodes.length; i++){

      var has_value = 0
      if(nodes[i].message.r.v) has_value = 1

        geo_node(nodes[i].node.address, has_value).then(function (res){

          console.log(res.geo.lat+", "+res.geo.lon)

        //var distance = distance(message.r.id.toString('hex'), infoHash)

        //console.log(distance)
        if (lat == 1)
        {
          socket.emit('new_node', {
            long: res.geo.lon,
            lat: res.geo.lat,
          has_value: res.has_value/*,
          distance: distance*/
        });
        }
      })

    }
  })
});


var nb_requetes = 0
var old_date = 0

function geo_node(ip, has_value) {
  return new Promise((resolve, reject) => {

    if(nb_requetes < 150) {
      nb_requetes++;
      request('http://ip-api.com/json/'+ip, function (error, response, body) {
        if (!error && response.statusCode == 200) {
         var donnees = JSON.parse(body);
         resolve({geo: donnees, has_value: has_value})
       }
       reject(error)
     })
    }
    else {
      if((Math.floor(new Date() / 1000) - old_date) > 60)
      {
        nb_requetes = 0
      }
    }

    if((Math.floor(new Date() / 1000) - old_date) > 60)
    {
      old_date = Math.floor(new Date() / 1000)
    }
  });
}

function distance(firstId, secondId) {
  var distance = 0
  var min = Math.min(firstId.length, secondId.length)
  var max = Math.max(firstId.length, secondId.length)
  for (var i = 0; i < min; ++i) distance = distance * 256 + (firstId[i] ^ secondId[i])
    for (; i < max; ++i) distance = distance * 256 + 255

      distance = distance / Math.pow(10, 80)

    return distance
  }