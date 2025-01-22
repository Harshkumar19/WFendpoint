import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";
import { connectToDatabase } from "./db.js";
import { getNextScreen } from "./flow.js";

dotenv.config();

const app = express();
const { APP_SECRET, PRIVATE_KEY, PASSPHRASE = "", PORT = "3000" } = process.env;

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  })
);

// Initialize database connection when server starts
connectToDatabase().catch(console.error);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Main endpoint
app.post("/", async (req, res) => {
  if (!PRIVATE_KEY) {
    console.error('Private key is missing. Check "PRIVATE_KEY" in your environment variables.');
    return res.status(500).send();
  }

  let decryptedRequest;
  try {
    // Decrypt the request
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    return res.status(421).send(); // Return 421 if decryption fails
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  let responsePayload;
  try {
    // Process the request
    responsePayload = await getNextScreen(decryptedBody);
    console.log("👉 Response Payload:", responsePayload);
  } catch (error) {
    console.error("Error processing request:", error);
    responsePayload = { error: "Internal server error" };
  }

  try {
    // Encrypt the response payload
    const encryptedResponse = encryptResponse(
      responsePayload,
      aesKeyBuffer,
      initialVectorBuffer
    );

    res.status(200).send(encryptedResponse);
  } catch (encryptionError) {
    console.error("Encryption failed:", encryptionError);
    res.status(500).send();
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res
    .status(200)
    .send(`<pre>Nothing to see here.\nCheckout README.md to start.</pre>`);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});

// Decrypt the incoming request
function decryptRequest(body, privatePem, passphrase) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body;

  const privateKey = crypto.createPrivateKey({ key: privatePem, passphrase });
  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(encrypted_aes_key, "base64")
  );

  const flowDataBuffer = Buffer.from(encrypted_flow_data, "base64");
  const initialVectorBuffer = Buffer.from(initial_vector, "base64");

  const TAG_LENGTH = 16;
  const encrypted_flow_data_body = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const encrypted_flow_data_tag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    initialVectorBuffer
  );
  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf-8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer,
  };
}

// Encrypt the response payload
function encryptResponse(response, aesKeyBuffer, initialVectorBuffer) {
  const flipped_iv = [];
  for (const pair of initialVectorBuffer.entries()) {
    flipped_iv.push(~pair[1]);
  }

  const cipher = crypto.createCipheriv(
    "aes-128-gcm",
    aesKeyBuffer,
    Buffer.from(flipped_iv)
  );

  return Buffer.concat([
    cipher.update(JSON.stringify(response), "utf-8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
