const express = require("express");
const bodyParser = require('body-parser');
const app = express()
 
let peakFreqState = 0; 

let singingState = "not singing";
app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});
 
// Handle POST /peakFreq to update the peak frequency
app.post('/peakFreq', (req, res) => {
    console.log('Received peak frequency:', req.body);
    if (req.body.peakFrequency && typeof req.body.peakFrequency === 'number') {
        peakFreqState = req.body.peakFrequency; // Update the peak frequency state
        console.log("Updated peak frequency:", peakFreqState);
        res.send({ message: `Peak frequency updated to: ${peakFreqState}` });
    } else {
        res.status(400).send({ message: "Invalid peak frequency. Please send a number." });
    }
});

// Handle GET /peakFreq to get the current peak frequency
app.get('/peakFreq', (req, res) => {
    res.json({ peakFrequency: peakFreqState }); // Send the current peak frequency
});

//Handle GET /singing to get current singing status
app.get('/singing', (req, res) => {
    res.send(singingState) //get the singing state
})

//Post for singing to update singing status
app.post('/singing', (req, res) => {
console.log('Recieved singing state:', req.body); 
if (req.body.state === "singing" || req.body.state === "Non-singing") {
    singingState = req.body.state;
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