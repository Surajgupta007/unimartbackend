
// MongoDB Connection Test
const mongoose = require("mongoose");
require("dotenv").config({ path: "/Users/surajgupta/Desktop/unimartnew/backend/.env" });

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });
