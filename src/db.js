// db.js
import { MongoClient, ServerApiVersion } from "mongodb";

const uri =
  "mongodb+srv://karanvishwakarma732:qG4teTOnH2KbT6iH@cluster0.t0bbl.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let dbConnection = null;

export const connectToDatabase = async () => {
  try {
    await client.connect();
    dbConnection = client.db("appointments");
    console.log("Successfully connected to MongoDB!");
    return dbConnection;
  } catch (error) {
    console.error("Could not connect to MongoDB:", error);
    throw error;
  }
};

export const getDb = () => dbConnection;
