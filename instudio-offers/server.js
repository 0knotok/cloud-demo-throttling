const express = require('express');
const multer = require('multer');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromEnv } = require('@aws-sdk/credential-provider-env');
const rateLimit = require('express-rate-limit'); // Importar el middleware

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

// Configuración del middleware de Throttling
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // Límite de 10 solicitudes por IP
  message: 'Demasiadas solicitudes de subida de imagen desde esta IP. Intenta nuevamente después de un minuto.',
});

// Ruta para subir imágenes con el middleware de throttling
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

app.listen(port, () => {
  console.log(`Microservicio instudio-offers corriendo en http://localhost:${port}`);
});
