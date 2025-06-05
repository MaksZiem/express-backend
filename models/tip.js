const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const tipSchema = new Schema(
  {
    amount: { type: Number, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "Tips" }
);

module.exports = mongoose.model("Tip", tipSchema);
