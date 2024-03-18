const express = require('express');
const PORT = 3000;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('./views'));

app.set('view engine', 'ejs');
app.set('views', './views');

// Code có sử dụng AWS
const multer = require('multer');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();

AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
});

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const bucketName = process.env.S3_BUCKET_NAME;
const tableName = process.env.DYNAMODB_TABLE_NAME;

const storage = multer.memoryStorage({
    destination: function (req, file, callback) {
        callback(null, '');
    }
});

const upload = multer({
    storage,
    limits: {
        fieldNameSize: 2000000
    },
    fileFilter(req, file, callback) {
        checkFileType(file, callback);
    }
});

function checkFileType(file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
        return cb(null, true);
    }
    return cb('Error: Images Only!');
}

app.get('/', async (req, res) => {
    try {
        const params = { TableName: tableName }
        const data = await dynamodb.scan(params).promise();
        console.log("Data=", data.Items)
        return res.render('index.ejs', { courses: data.Items });
    } catch (error) {
        console.log("Error=", error)
        return res.status(500).send("Internal Server Error");
    }
});

app.post('/save', upload.single('image'), async (req, res) => {
    try {
        const maXe = req.body.maXe;
        const dongXe = req.body.dongXe;
        const loaiXe = req.body.loaiXe;
        const gia = req.body.gia;

        const image = req.file?.originalname.split(".");
        console.log("Maxe=", maXe)
        console.log("DongXe=", dongXe)
        console.log("LoaiXe=", loaiXe)
        console.log("Gia=", gia)
        console.log("Image=", image)
        const fileType = image[image.length - 1];
        const filePath = `${maXe}_${Date.now().toString()}.${fileType}`;

        const params = {
            Bucket: bucketName,
            Key: filePath,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        };

        s3.upload(params, async (err, data) => {
            if (err) {
                console.log("Error=", err);
                return res.status(500).send("Internal Server Error");
            } else {
                const imageUrl = data.Location;
                const paramsDynamoDB = {
                    TableName: tableName,
                    Item: {
                        maXe: maXe,
                        dongXe: dongXe,
                        loaiXe: loaiXe,
                        gia: gia,
                        image: imageUrl
                    }
                };

                await dynamodb.put(paramsDynamoDB).promise();
                return res.redirect('/');
            }
        });
    } catch (error) {
        console.log("Error=", error);
        return res.status(500).send("Internal Server Error");
    }
});

app.post('/delete', async (req, res) => {
    const listCheckBoxSelected = Object.keys(req.body);

    if (!listCheckBoxSelected || listCheckBoxSelected.length === 0) {
        return res.redirect('/');
    }

    try {
        function onDelete(length) {
            const params = {
                TableName: tableName,
                Key: {
                    maXe: listCheckBoxSelected[length],
                }
            };

            dynamodb.delete(params, (err, data) => {
                if (err) {
                    console.log("Error=", err);
                    return res.status(500).send("Internal Server Error");
                } else if (length > 0) {
                    onDelete(length - 1);
                } else {
                    return res.redirect('/');
                }
            });
        }

        onDelete(listCheckBoxSelected.length - 1);
    } catch (error) {
        console.error("Error=", error);
        return res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

