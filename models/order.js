const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const orderSchema = new Schema({
    dishes: [{
        dish: {type: Object, required: true},
        quantity: {type: Number, required: true},
        status: { type: String, enum: ['niegotowy', 'gotowy', 'wydane'], default: 'niegotowy' },
        preparedBy: { type: Schema.Types.ObjectId, ref: 'User'}, // ID kucharza
        doneByCookDate: {
            type: String,
            required: false
        },
    }],
    user: {
        name: {
            type: String,
            required: true
        },
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        }
    },
    price: {
        type: Number,
        required: true
    },
    orderDate: {
        type: String,
        required: true
    },
    tableNumber: {
        type: String,  
        required: true
    }
});

// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const orderSchema = new Schema({
//     user: {
//         name: { type: String, required: true },
//         userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }
//     },
//     dishes: [
//         {
//             dish: { type: Schema.Types.ObjectId, ref: 'Dish', required: true },
//             quantity: { type: Number, required: true },
//             status: { type: String, enum: ['niegotowy', 'gotowy'], default: 'niegotowy' }
//         }
//     ],
//     price: { type: Number, required: true },
//     orderDate: { type: String, required: true },
//     addedDate: { type: String, required: true },
//     tableNumber: { type: Number, required: true }
// });

// module.exports = mongoose.model('Order', orderSchema);


// moze byc dobre
// orderSchema.statics.getYearSummary = function () {
//     return this.find()
//         .then(orders => {
//             // Zapisanie statystyk w tablicy rocznej
//             let year = [[], [], [], [], [], [], [], [], [], [], [], []];
//             orders.forEach((order) => {
//                 for (let j = 1; j <= 3; j++) {
//                     if (order.orderDate.slice(0, 2) == j) {
//                         year[j - 1].push(order);
//                     }
//                 }
//             });
//             return year;
//         }
//         ).catch(err => {
//             console.log(err);
//             throw err;
//         });
        
// }


// orderSchema.statics.groupOrdersByMonth = function(orders, callback) {
//     let months = [[],[],[],[],[],[],[],[],[],[],[],[]];
    
//         orders.forEach((order) => {
//             switch (order.orderDate.slice(0, 2)) {
//                 case "01":
//                     months[0].push(order);
//                     break;
//                 case "02":
//                     months[1].push(order);
//                     break;
//                 case "03":
//                     months[2].push(order);
//                     break;
//                 case "04":
//                     months[3].push(order);
//                     break;
//                 case "05":
//                     months[4].push(order);
//                     break;
//                 case "06":
//                     months[5].push(order);
//                     break;
//                 case "07":
//                     months[6].push(order);
//                     break;
//                 case "08":
//                     months[7].push(order);
//                     break;
//                 case "09":
//                     months[8].push(order);
//                     break;
//                 case "10":
//                     months[9].push(order);
//                     break;
//                 case "11":
//                     months[10].push(order);
//                     break;
//                 case "12":
//                     months[11].push(order);
//                     break;
//                 default:
//                     // Obsługa błędnych danych
//             }
//         });
//         callback(null, months);
//     };


// orderSchema.methods.AllOrdersPerMonth = function() {
//     let months = [[],[],[],[],[],[],[],[],[],[],[],[]]
//     switch (order.orderDate.slice(0, 2)) {
//         case "01":
//             months[0].push(order)
//             break;
//         case "02":
//             months[1].push(order)
//             break;
//         case "03":
//             months[2].push(order)
//             break;
//         case "04":
//             months[3].push(order)
//             break;
//         case "05":
//             months[4].push(order)
//             break;
//         case "06":
//             months[5].push(order)
//             break;
//         case "07":
//             months[6].push(order)
//             break;
//         case "08":
//             months[7].push(order)
//             break;
//         case "09":
//             months[8].push(order)
//             break;
//         case "10":
//             months[9].push(order)
//             break;
//         case "1":
//             months[10].push(order)
//             break;
//         case "12":
//             months[11].push(order)
//             break;
        
//         default:
//             monthName = ""; // Dodaj obsługę błędnych danych
//     }


//     return months;
//   };

module.exports = mongoose.model('Order', orderSchema)