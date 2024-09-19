const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const tableSchema = new Schema({
    number: {
        type: Number,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['free', 'waiting', 'delivered'],
        default: 'free'
    },
    order: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    }
});

module.exports = mongoose.model('Table', tableSchema);
