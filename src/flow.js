/**
 * Server-side code for appointment scheduling flow
 */

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
          id: "Kids",
          title: "Kids",
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
  CONFIRMATION: {
    screen: "CONFIRMATION",
    data: {
      gender: "",
      appointment_date: "",
      appointment_time: "",
      notes: "",
    },
  },
};

export const getNextScreen = async (decryptedBody) => {
  const { screen, data, action, flow_token } = decryptedBody;

  // Log incoming request data
  console.log("Incoming request:", {
    screen,
    data,
    action,
    flow_token,
  });

  // Handle health check request
  if (action === "ping") {
    console.log("Health check ping received");
    return {
      data: {
        status: "active",
      },
    };
  }

  // Handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  // Handle initial flow request
  if (action === "INIT") {
    console.log("Initializing flow with SCHEDULE screen");
    return SCREEN_RESPONSES.SCHEDULE;
  }

  if (action === "data_exchange") {
    console.log("Processing data exchange for screen:", screen);

    switch (screen) {
      case "SCHEDULE":
        // Log appointment scheduling data
        console.log("Appointment scheduling data:", data);
        return {
          screen: "CONFIRMATION",
          data: {
            gender: data.gender,
            appointment_date: data.appointment_date,
            appointment_time: data.appointment_time,
            notes: data.notes || "No additional notes provided.",
          },
        };

      case "CONFIRMATION":
        // Log confirmation data
        console.log("Processing confirmation:", data);
        // Here you would typically save the appointment to your database
        console.log("Appointment confirmed:", {
          gender: data.gender,
          date: data.appointment_date,
          time: data.appointment_time,
          notes: data.notes,
        });

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

      default:
        console.error("Unhandled screen:", screen);
        throw new Error(Unhandled);
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};

// Example test code
const testFlow = async () => {
  // Test INIT
  const initResponse = await getNextScreen({
    action: "INIT",
    data: {},
  });
  console.log("INIT Response:", initResponse);

  // Test scheduling appointment
  const scheduleResponse = await getNextScreen({
    action: "data_exchange",
    screen: "SCHEDULE",
    data: {
      gender: "male",
      appointment_date: "2025-01-23",
      appointment_time: "0_morning",
      notes: "First time visit",
    },
  });
  console.log("Schedule Response:", scheduleResponse);

  // Test confirmation
  const confirmResponse = await getNextScreen({
    action: "data_exchange",
    screen: "CONFIRMATION",
    data: {
      gender: "male",
      appointment_date: "2025-01-23",
      appointment_time: "0_morning",
      notes: "First time visit",
    },
    flow_token: "test-token",
  });
  console.log("Confirmation Response:", confirmResponse);
};

// Uncomment to run test
// testFlow();