const { Schema, model } = require("mongoose");

const ticketSchema = new Schema({
  spaetiId: {
    type: Schema.Types.ObjectId,
    ref: "Spaeti",
    required: true,
  },
  changes: {
    type: Map,
    of: Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

const Ticket = model("Ticket", ticketSchema);
module.exports = Ticket;
