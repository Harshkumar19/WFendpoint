// flow.js
import { getDb } from "./db.js";

const SCREEN_RESPONSES = {
  SCHEDULE: {
    screen: "SCHEDULE",
    data: {
      gender: [
        {
          id: "male",
          title: "Male",
        },
        {
          id: "female",
          title: "Female",
        },
        {
          id: "Unisex",
          title: "Unisex",
        },
      ],
      times: [
        {
          id: "0_morning",
          title: "09:00 AM - 11:00 AM",
        },
        {
          id: "1_afternoon",
          title: "02:00 PM - 04:00 PM",
        },
        {
          id: "2_evening",
          title: "05:00 PM - 07:00 PM",
        },
      ],
    },
  },
};

export const getNextScreen = async (decryptedBody) => {
  const { screen, data, action, flow_token } = decryptedBody;

  console.log("Incoming request:", { screen, data, action, flow_token });

  if (action === "ping") {
    console.log("Health check ping received");
    return {
      data: {
        status: "active",
      },
    };
  }

  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  if (action === "INIT") {
    console.log("Initializing flow with SCHEDULE screen");
    return SCREEN_RESPONSES.SCHEDULE;
  }

  if (action === "data_exchange") {
    console.log("Processing data exchange for screen:", screen);

    switch (screen) {
      case "SCHEDULE":
        try {
          const db = getDb();
          const appointmentsCollection = db.collection("appointments");

          const appointmentData = {
            gender: data.gender,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            notes: data.notes || "No additional notes provided.",
            created_at: new Date(),
            flow_token: flow_token,
          };

          await appointmentsCollection.insertOne(appointmentData);
          console.log("Appointment saved to database:", appointmentData);

          return {
            screen: "SUCCESS",
            data: {
              extension_message_response: {
                params: {
                  flow_token,
                  appointment_confirmed: true,
                },
              },
            },
          };
        } catch (error) {
          console.error("Error saving appointment:", error);
          throw error;
        }

      default:
        console.error("Unhandled screen:", screen);
        throw new Error(`Unhandled screen type: ${screen}`);
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};
