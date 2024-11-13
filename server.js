const express = require("express");
const bodyParser = require('body-parser');
const app = express()
let state = "waiting..."
let colours = []

let singingState = "not singing";
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});

// Handling GET /hello request
app.get("/waiting", (req, res, next) => { //waiting not currently in use but will incorporate for knowing when three players have joined
   console.log('waiting...', req.socket.remoteAddress);
  res.send(state);
 })

app.post('/waiting', (req, res) => { //post request 
    console.log('wa', req.body);
    colours.push(req.body);
    res.send(state)
  });
 

//Handle GET /singing to get current singing status
app.get('/singing', (req, res) => {
    console.log('current singing state:', singingState); 
    res.send(singingState) //get the singing state
})

//Post for singing to update singing status
app.post('/singing', (req, res) => {
console.log('Recieved singing state:', req.body);
if (req.body.state === "singing" || req.body.state === "not singing") {
    singingState = state;
    console.log("Recieved singing state:", state);
    res.send({message:'singing state upated to: ${singingState}'});
}else{
 res.status(400).send({message: "Invalid state. Please send 'singing' or 'Non-singing'."});
}
});

// Server setup
app.listen(3000, () => {
    console.log("Server is Running")
})