const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const serverless = require("serverless-http");

dotenv.config();

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);

const app = express();
const PORT = process.env.PORT || 4000;
const router = express.Router();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL,
});

const db = admin.firestore();

app.use(bodyParser.json());

router.get('/hello', (req, res) => {
    res.send("Holaaaaa!!!!!");
});

// Endpoint para enviar una notificación a un usuario específico
router.post("/notify", async (req, res) => {
  const { token, title, body } = req.body;

  const message = {
    notification: {
      title: title,
      body: body,
    },
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    res.status(200).send(`Mensaje enviado correctamente: ${response}`);
  } catch (error) {
    res.status(500).send(`Error al enviar el mensaje: ${error}`);
  }
});

// Endpoint para enviar notificación a todos los empleados de un rol
router.post("/notify-role", async (req, res) => {
  const { title, body, role } = req.body;

  try {
    const employeeTokens = [];
    const querySnapshot = await db
      .collection("users")
      .where("rol", "==", role)
      .get();
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(data.token);
      if (data.token) {
        employeeTokens.push(data.token);
      }
    });

    if (employeeTokens.length === 0) {
      return res
        .status(404)
        .send("No hay usuarios a los que enviar un mensaje");
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: employeeTokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    res.status(200).send(`Mensajes enviados: ${response.successCount}`);
  } catch (error) {
    res.status(500).send(`Error al enviar mensaje: ${error}`);
  }
});

// Endpoint para enviar un mail a un usuario
router.post("/send-mail", async (req, res) => {
  try {
    const { aceptacion, nombreUsuario, mail } = req.body;
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.MAIL,
        pass: process.env.PASSWORD,
      },
    });

    let resultado = await transporter.sendMail({
      from: '"Mi Comanda" <comandaferrero@gmail.com>',
      to: mail,
      subject: aceptacion
        ? "Felicitaciones su cuenta fue aceptada"
        : "Disculpe pero hemos bloqueado su cuenta",
      html: `
      <h1>${aceptacion ? "Felicitaciones " : "Disculpe "} ${nombreUsuario}</h1>
      <p>Su cuenta fue ${aceptacion ? "aceptada" : "rechazada"}</p>
      <p>Saludos La Comanda</p>
      `,
    });
    res.json({ ...resultado, seEnvio: true });
  } catch (e) {
    res.json({
      mensaje: "No se pudo enviar el mail",
      seEnvio: false,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use("/.netlify/functions/index", router);

module.exports.handler = serverless(app);
