const express = require('express');
const app = express();
const https = require('https');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config();
var cookies = require("cookie-parser");
var bodyParser = require('body-parser')
const docx = require('docx');
app.use(cookies());
const fs = require("fs");

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(cors({
    // origin: "*",
    origin: ["http://localhost:5173", "http://localhost:4000"],
    credentials: true,
}));
// app.use(express.json());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
const port = process.env.port || 4000;


const caicachhanhchinhRoute = require('./routes/caicachhanhchinh');
const authRoute = require('./routes/auth');
const caicachRoute = require('./routes/updatecaicach');

app.use('/auth', authRoute);
app.use('/cham-diem', caicachhanhchinhRoute);
app.use('/cchc', caicachRoute);

const path = require("path");
const basePath = '';

app.use(express.static(path.join(__dirname, '/upload')));
app.use(express.static('upload'));
app.use(express.static('public'));

//cấu hình chạy reactjs trên node server
app.use(basePath + "/", express.static(path.resolve(__dirname + "/dist")));

app.get("*", (request, response) => {
  response.sendFile(path.resolve(__dirname + "/dist/index.html"));
});

const { cronjob_file } = require('./controllers/cronjob');
const options = {
  key: fs.readFileSync('server.key'), // Đường dẫn tới file key
  cert: fs.readFileSync('server.crt') // Đường dẫn tới file cert
}
https.createServer(options,app).listen(port, () => {
    console.log('server running ', port)
});

mongoose.set('strictQuery', true);
mongoose.connect("mongodb://localhost:27017/chamdiemcaicachBCA", {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, (err) => {
    if (err) {
        console.log(err)
    }
    console.log('kết nối db thành công')
})
