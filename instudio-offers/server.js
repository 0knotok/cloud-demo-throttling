const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const Offer = require('./models/Offer');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json()); // Middleware para parsear JSON

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuración del cliente de S3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: fromEnv(),
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("Conexión a MongoDB exitosa"))
  .catch(error => console.error("Error conectando a MongoDB:", error));

// Configuración de throttling para subida de imágenes
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Límite de 10 solicitudes por IP
  message: 'Demasiadas solicitudes de subida de imagen desde esta IP. Intenta nuevamente después de un minuto.',
});

// Configuración de throttling para crear ofertas
const offerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // Límite de 5 solicitudes por IP
  message: 'Demasiadas solicitudes para crear ofertas desde esta IP. Intenta nuevamente después de un minuto.',
});

// Ruta para subir imágenes a S3 con throttling
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
    await s3.send(command);

    const url = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
    
    return res.status(200).send({
      message: 'Imagen subida correctamente.',
      url: url,
    });
  } catch (error) {
    return res.status(500).send('Error al subir la imagen: ' + error.message);
  }
});

// Obtener ofertas
app.get('/offers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50; // Límite de documentos a devolver
    const offers = await Offer.find().limit(limit);
    res.status(200).json(offers);
  } catch (error) {
    res.status(500).send('Error al obtener las ofertas: ' + error.message);
  }
});

// Ruta para crear una nueva oferta con throttling
app.post('/api/offers', offerLimiter, async (req, res) => {
  try {
    const { offers_id, salon_id, title, start_date, end_date, condition, description, discount, image_url, is_active } = req.body;

    const newOffer = new Offer({
      offers_id,
      salon_id,
      title,
      start_date,
      end_date,
      condition,
      description,
      discount,
      image_url,
      is_active
    });

    const savedOffer = await newOffer.save();
    res.status(201).json({ message: 'Oferta creada exitosamente', offer: savedOffer });
  } catch (error) {
    console.error('Error al crear la oferta:', error);
    res.status(500).json({ message: 'Error al crear la oferta', error });
  }
});

app.listen(port, () => {
  console.log(`Microservicio instudio-offers corriendo en http://localhost:${port}`);
});
