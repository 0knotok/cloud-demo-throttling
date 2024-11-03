const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuración del cliente de S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

// Configuración del cliente de MongoDB
const mongoClient = new MongoClient(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

let db;
mongoClient.connect()
  .then(client => {
    db = client.db(process.env.MONGO_DB_NAME);
    console.log("Conexión a MongoDB exitosa");
  })
  .catch(error => console.error("Error conectando a MongoDB:", error));

// Configuración de Throttling
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Límite de 10 solicitudes por IP
  message: 'Demasiadas solicitudes de subida de imagen desde esta IP. Intenta nuevamente después de un minuto.',
});

// Ruta para subir imágenes con throttling
app.post('/upload', uploadLimiter, upload.single('image'), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).send('No hay archivo para subir.');
  }

  const params = {
    Bucket: process.env.S3_BUCKET,
    Key: `offers/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const command = new PutObjectCommand(params);
    const data = await s3.send(command);

    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
    
    return res.status(200).send({
      message: 'Imagen subida correctamente.',
      url: url,
    });
  } catch (error) {
    return res.status(500).send('Error al subir la imagen: ' + error.message);
  }
});

// Obtener ofertas limitadas desde MongoDB
app.get('/offers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50; // Límite de documentos a devolver
    const offersCollection = db.collection('offers');

    const offers = await offersCollection.find().limit(limit).toArray();
    res.status(200).json(offers);
  } catch (error) {
    res.status(500).send('Error al obtener las ofertas: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Microservicio instudio-offers corriendo en http://localhost:${port}`);
});
