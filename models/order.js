const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const orderSchema = new Schema(
  {
    dishes: [
      {
        dish: { type: Object, required: true },
        quantity: { type: Number, required: true },
        status: {
          type: String,
          enum: ["niegotowy", "gotowy", "wydane"],
          default: "niegotowy",
        },
        preparedBy: { type: Schema.Types.ObjectId, ref: "User" },
        doneByCookDate: {
          type: Date,
          required: false,
        },
      },
    ],
    user: {
      name: {
        type: String,
        required: true,
      },
      userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },
    },
    price: {
      type: Number,
      required: true,
    },
    orderDate: {
      type: Date,
      required: true,
    },
    tableNumber: {
      type: String,
      required: true,
    },
  },
  { collection: "Orders" }
);

module.exports = mongoose.model("Order", orderSchema);
