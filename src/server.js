// server.js
import express from "express";
import {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
} from "./encryption.js";
import { getNextScreen } from "./flow.js";
import { connectToDatabase } from "./db.js";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  })
);

const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "", PORT = "3000" } = process.env;

// Initialize database connection when server starts
connectToDatabase().catch(console.error);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.post("/", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your env variable "PRIVATE_KEY".'
    );
  }

  // Handle unencrypted health check
  if (req.body?.action === "health_check") {
    return res.status(200).json({
      data: {
        status: "healthy",
      },
    });
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send();
  }

  let decryptedRequest = null;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error(err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  try {
    const screenResponse = await getNextScreen(decryptedBody);
    console.log("👉 Response to Encrypt:", screenResponse);

    // Don't encrypt health check responses
    if (decryptedBody.action === "health_check") {
      return res.status(200).json(screenResponse);
    }

    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (error) {
    console.error("Error processing request:", error);
    res
      .status(500)
      .send(
        encryptResponse(
          { error: "Internal server error" },
          aesKeyBuffer,
          initialVectorBuffer
        )
      );
  }
});

app.get("/", (req, res) => {
  res
    .status(200)
    .send(`<pre>Nothing to see here.\nCheckout README.md to start.</pre>`);
});

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});

function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn(
      "App Secret is not set up. Please Add your app secret in the .env file to check for request validation"
    );
    return true;
  }

  const signatureHeader = req.get("x-hub-signature-256");
  console.log("Received Signature Header:", signatureHeader);

  if (!signatureHeader) {
    console.error("Error: Missing 'x-hub-signature-256' header.");
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    console.error("Error: Invalid signature format.");
    return false;
  }

  const signatureBuffer = Buffer.from(
    signatureHeader.replace("sha256=", ""),
    "hex"
  );

  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest("hex");
  const digestBuffer = Buffer.from(digestString, "hex");

  console.log("Digest Buffer Length:", digestBuffer.length);
  console.log("Signature Buffer Length:", signatureBuffer.length);

  if (digestBuffer.length !== signatureBuffer.length) {
    console.error("Error: Buffer lengths do not match.");
    return false;
  }

  if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request Signature did not match.");
    return false;
  }

  return true;
}
