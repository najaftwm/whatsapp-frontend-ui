import Pusher from "pusher-js";

// Use the same config as backend/config.php
export const pusher = new Pusher("573a0a8b82064304ef42", {
  cluster: "ap2",
  encrypted: true,
});

// Optional: log connection status in console
pusher.connection.bind("connected", () => {
  // Pusher connected successfully
});

pusher.connection.bind("error", () => {
  // Pusher connection error - handled silently
});
