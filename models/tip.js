const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tipSchema = new Schema({
  amount: { type: Number, required: true }, // Kwota napiwku
  order: { type: Schema.Types.ObjectId, ref: 'Order', required: true }, // ID zamówienia
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true } // ID użytkownika (kelner)
});

module.exports = mongoose.model('Tip', tipSchema);
