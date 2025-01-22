import express from "express";
import { decryptRequest, encryptResponse, FlowEndpointException } from "./encryption.js";
import { getNextScreen } from "./flow.js";
import { connectToDatabase } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const { PRIVATE_KEY, PASSPHRASE = "", PORT = "3000" } = process.env;

app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  })
);

// Initialize database connection
connectToDatabase().catch(console.error);

app.post("/", async (req, res) => {
  if (!PRIVATE_KEY) {
    console.error('Private key is missing. Please check your environment variables.');
    return res.status(500).send();
  }

  let decryptedRequest;
  try {
    // Decrypt the incoming request
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("Decrypted Request:", decryptedBody);

  let responsePayload;
  try {
    // Process the request and generate a response payload
    responsePayload = await getNextScreen(decryptedBody);
    console.log("Response Payload:", responsePayload);
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

app.listen(PORT, () => {
  console.log(`Server is listening on port: ${PORT}`);
});
