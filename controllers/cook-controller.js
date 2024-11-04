const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const Dish = require("../models/dish");
const Order = require("../models/order");
const Ingredient = require("../models/ingredient");
const Table = require("../models/table");
const Tip = require("../models/tip");
const mongoose = require("mongoose");

exports.getWaitingOrders2 = async (req, res, next) => {
  try {
    const tablesWithWaitingOrders = await Table.find({
      status: "waiting",
    }).populate({
      path: "order",
      populate: {
        path: "dishes.dish",
        model: "Dish",
      },
    });

    if (!tablesWithWaitingOrders || tablesWithWaitingOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "Nie znaleziono zamówień w statusie 'waiting'." });
    }

    const waitingOrders = tablesWithWaitingOrders
      .map((table) => table.order)
      .filter((order) => order !== null);

    res.status(200).json({
      message: "Znaleziono zamówienia w statusie 'waiting'.",
      orders: waitingOrders,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania zamówień." });
  }
};

exports.getWaitingOrders = async (req, res, next) => {
  try {
    const tablesWithWaitingOrders = await Table.find({
      status: "waiting",
    }).populate({
      path: "order",
      populate: {
        path: "dishes.dish",
        model: "Dish",
      },
    });

    if (!tablesWithWaitingOrders || tablesWithWaitingOrders.length === 0) {
      return res
        .status(404)
        .json({ message: "Nie znaleziono zamówień w statusie 'waiting'." });
    }

    const waitingOrders = tablesWithWaitingOrders
      .map((table) => table.order)
      .filter((order) => order !== null);


    const ordersWithDishStatus = waitingOrders.map((order) => ({
      orderId: order._id,
      tableNumber: order.tableNumber,
      dishes: order.dishes.map((dishItem) => ({
        id: dishItem.dish._id,
        dishName: dishItem.dish.name,
        quantity: dishItem.quantity,
        status: dishItem.status,
      })),
      price: order.price,
      orderDate: order.orderDate,
    }));

    res.status(200).json({
      message: "Znaleziono zamówienia w statusie 'waiting'.",
      orders: ordersWithDishStatus,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Wystąpił błąd podczas pobierania zamówień." });
  }
};

exports.markOrderAsDelivered = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    console.log("wykonane");
    const table = await Table.findOne({ order: orderId });
    if (table) {
      console.log(table.number);
      table.status = "delivered";
      await table.save();
    }

    await order.save();

    res.status(200).json({ message: "Order marked as delivered." });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.markDishAsReady2 = async (req, res, next) => {
  const { orderId, dishName } = req.params;

  try {

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }


    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }


    dish.status = "gotowy";
    await order.save();

    res.status(200).json({ message: "Dish marked as ready." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.markDishAsReady3 = async (req, res, next) => {
  const { orderId, dishName } = req.params;

  try {

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }


    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }


    dish.status = "gotowy";
    console.log("zmiana prepared by: " + req.userData.userId);
    dish.preparedBy = req.userData.userId;
    console.log("prepared by: " + dish.preparedBy);

    await order.save();

    res.status(200).json({ message: "Dish marked as ready by cook." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.markDishAsReady = async (req, res, next) => {
  const { orderId, dishName } = req.params;

  try {

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }


    const dish = order.dishes.find((d) => d.dish.name === dishName);
    if (!dish) {
      return res.status(404).json({ message: "Dish not found." });
    }


    dish.status = "gotowy";
    dish.preparedBy = req.userData.userId;


    const currentDate = new Date();
    const day = currentDate.getDate().toString().padStart(2, "0");
    const month = (currentDate.getMonth() + 1).toString().padStart(2, "0");
    const year = currentDate.getFullYear();
    const hours = currentDate.getHours().toString().padStart(2, "0");
    const minutes = currentDate.getMinutes().toString().padStart(2, "0");
    const seconds = currentDate.getSeconds().toString().padStart(2, "0");


    dish.doneByCookDate = `${month}.${day}.${year} ${hours}:${minutes}:${seconds}`;


    await order.save();

    res.status(200).json({
      message: "Dish marked as ready by cook.",
      doneByCookDate: dish.doneByCookDate,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred." });
  }
};

exports.getDishesPreparedByCook2 = async (req, res, next) => {
  const cookId = req.params.cookId;

  try {

    const orders = await Order.find({ "dishes.preparedBy": cookId });


    const dishesPreparedByCook = orders.flatMap((order) =>
      order.dishes
        .filter(
          (dish) => dish.preparedBy && dish.preparedBy.toString() === cookId
        )
        .map((dish) => {
        
          const orderDate = new Date(order.orderDate);
          const doneByCookDate = new Date(dish.doneByCookDate);

        
          const cookingTime = (doneByCookDate - orderDate) / 1000;

          return {
            orderId: order._id,
            orderDate: order.orderDate,
            tableNumber: order.tableNumber,
            dishName: dish.dish.name,
            quantity: dish.quantity,
            status: dish.status,
            price: order.price,
            cookingTime: Math.max(0, cookingTime),
          };
        })
    );


    if (dishesPreparedByCook.length === 0) {
      return res
        .status(404)
        .json({ message: "No dishes found for this cook." });
    }

    console.log(dishesPreparedByCook);
    res.status(200).json(dishesPreparedByCook);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving dishes." });
  }
};

exports.getDishesPreparedByCook = async (req, res, next) => {
    console.log('cokolwiek')
    const cookId = req.params.cookId;
    console.log(cookId)
    try {
    
        const orders = await Order.find({ 'dishes.preparedBy': cookId });

    
        const ordersWithDishes = orders.map(order => {
            const dishesForOrder = order.dishes
                .filter(dish => dish.preparedBy && dish.preparedBy.toString() === cookId)
                .map(dish => {
                
                    const cookingTime = dish.doneByCookDate && order.orderDate 
                        ? Math.floor((new Date(dish.doneByCookDate) - new Date(order.orderDate)) / 1000)
                        : null;
                    
                    return {
                        dishName: dish.dish.name,
                        quantity: dish.quantity,
                        status: dish.status,
                        cookingTime: cookingTime,
                        doneByCookDate: dish.doneByCookDate,
                        orderDate: order.orderDate,
                        tableNumber: order.tableNumber
                    };
                });

            return {
                orderId: order._id,
                orderDate: order.orderDate,
                tableNumber: order.tableNumber,
                totalOrderPrice: order.price,
                dishes: dishesForOrder
            };
        });

    
        if (ordersWithDishes.length === 0) {
            return res.status(404).json({ message: 'No orders found for this cook.' });
        }

        res.status(200).json({ orders: ordersWithDishes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred while retrieving orders.' });
    }
};

exports.getDishesCountByCook = async (req, res, next) => {
    const cookId = req.params.cookId;
    try {
        const currentDate = new Date();

    
        const todayStart = new Date(currentDate.setUTCHours(0, 0, 0, 0));
        const todayEnd = new Date(currentDate.setUTCHours(23, 59, 59, 999));

        const dayOfWeek = currentDate.getUTCDay();

    
        const weekStart = new Date(currentDate);
        weekStart.setUTCDate(currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        weekStart.setUTCHours(0, 0, 0, 0);

    
        const weekEnd = new Date(currentDate);
        weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
        weekEnd.setUTCHours(23, 59, 59, 999);

        const monthStart = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
        const monthEnd = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0, 23, 59, 59, 999);

        const yearStart = new Date(currentDate.getUTCFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getUTCFullYear(), 11, 31, 23, 59, 59, 999);

    
        const counts = {
            today: 0,
            lastWeek: 0,
            lastMonth: 0,
            lastYear: 0,
        };

    
        const orders = await Order.find({ "dishes.preparedBy": cookId });

    
        orders.forEach((order) => {
            order.dishes.forEach((dish) => {
                if (dish.preparedBy && dish.preparedBy.toString() === cookId) {
                    const doneByCookDate = new Date(dish.doneByCookDate);

                
                    console.log(`Done by cook date: ${doneByCookDate}`);

                
                    if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
                        counts.today++;
                    }

                
                    if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
                        counts.lastWeek++;
                    }

                
                    if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
                        counts.lastMonth++;
                    }

                
                    if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
                        counts.lastYear++;
                    }
                }
            });
        });

        console.log("Counts: ", counts);
        console.log("Today range: ", todayStart, todayEnd);
        console.log("Week range: ", weekStart, weekEnd);
        console.log("Month range: ", monthStart, monthEnd);
        console.log("Year range: ", yearStart, yearEnd);

        res.status(200).json({
            message: "Counts of dishes prepared by cook retrieved successfully.",
            counts: counts,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "An error occurred while retrieving dish counts." });
    }
};


exports.getDishesCountByCook4 = async (req, res, next) => {
  const cookId = req.params.cookId;

  try {

    const currentDate = new Date();


    const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
    const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));

    const dayOfWeek = currentDate.getUTCDay();


    const weekStart = new Date(currentDate);
    weekStart.setUTCDate(
      currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );
    weekStart.setUTCHours(0, 0, 0, 0);


    const weekEnd = new Date(currentDate);
    weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
    weekEnd.setUTCHours(23, 59, 59, 999);

    const monthStart = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const monthEnd = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const yearStart = new Date(currentDate.getFullYear(), 0, 1);
    const yearEnd = new Date(
      currentDate.getFullYear(),
      11,
      31,
      23,
      59,
      59,
      999
    );


    const counts = {
      today: 0,
      lastWeek: 0,
      lastMonth: 0,
      lastYear: 0,
    };


    const orders = await Order.find({ "dishes.preparedBy": cookId });


    orders.forEach((order) => {
      order.dishes.forEach((dish) => {
        if (dish.preparedBy && dish.preparedBy.toString() === cookId) {
          const doneByCookDate = new Date(dish.doneByCookDate);

        
          if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
            counts.today++;
          }

        
          if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
            counts.lastWeek++;
          }

        
          if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
            counts.lastMonth++;
          }

        
          if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
            counts.lastYear++;
          }
        }
      });
    });


    console.log("Today range: ", todayStart, todayEnd);
    console.log("Week range: ", weekStart, weekEnd);
    console.log("Month range: ", monthStart, monthEnd);
    console.log("Year range: ", yearStart, yearEnd);

    res.status(200).json({
      message: "Counts of dishes prepared by cook retrieved successfully.",
      counts: counts,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving dish counts." });
  }
};

exports.getDishPreparationDetails = async (req, res, next) => {
    const { dishId } = req.body;

    try {
    
        const orders = await Order.find({ 'dishes.dish._id': dishId });

        if (!orders || orders.length === 0) {
            return res.status(404).json({ message: 'No records found for this dish.' });
        }

    
        const cookTimes = {};
        const dishOccurrences = [];

        orders.forEach(order => {
            order.dishes.forEach(dish => {
            
                if (dish.dish._id.toString() === dishId && dish.preparedBy && dish.doneByCookDate) {
                    const cookId = dish.preparedBy.toString();
                    const cookingTime = Math.floor((new Date(dish.doneByCookDate) - new Date(order.orderDate)) / 1000);

                
                    dishOccurrences.push({
                        cookId: cookId,
                        orderId: order._id,
                        tableNumber: order.tableNumber,
                        orderDate: order.orderDate,
                        doneByCookDate: dish.doneByCookDate,
                        cookingTime: cookingTime
                    });

                
                    if (!cookTimes[cookId]) {
                        cookTimes[cookId] = { totalCookingTime: 0, count: 0 };
                    }

                    cookTimes[cookId].totalCookingTime += cookingTime;
                    cookTimes[cookId].count += 1;
                }
            });
        });

    
        const cookAverageTimes = Object.keys(cookTimes).map(cookId => {
            return {
                cookId: cookId,
                averageTime: cookTimes[cookId].totalCookingTime / cookTimes[cookId].count
            };
        });

    
        cookAverageTimes.sort((a, b) => b.averageTime - a.averageTime);

    
        res.status(200).json({
            dishOccurrences: dishOccurrences,
            cooks: cookAverageTimes
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'An error occurred while retrieving dish preparation details.' });
    }
};

exports.getUserDishPreparationHistory = async (req, res, next) => {
    const { dishId, cookId } = req.params;
    
    try {
      const currentDate = new Date();
      const todayStart = new Date(currentDate.setHours(0, 0, 0, 0));
      const todayEnd = new Date(currentDate.setHours(23, 59, 59, 999));
      const dayOfWeek = currentDate.getUTCDay();
      
      const weekStart = new Date(currentDate);
      weekStart.setUTCDate(currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setUTCHours(0, 0, 0, 0);
      
      const weekEnd = new Date(currentDate);
      weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
      weekEnd.setUTCHours(23, 59, 59, 999);
      
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999);
  
      const orders = await Order.find({
        "dishes.dish._id": new mongoose.Types.ObjectId(dishId),
        "dishes.preparedBy": new mongoose.Types.ObjectId(cookId),
      });
  
      if (!orders || orders.length === 0) {
        return res.status(404).json({ message: 'Nie ma takiego dania.' });
      }
  
      const userDishes = [];
      let totalCookingTime = 0;
      let dishCount = 0;
      const counts = { today: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };

      console.log("Today range: ", todayStart, todayEnd);
    console.log("Week range: ", weekStart, weekEnd);
    console.log("Month range: ", monthStart, monthEnd);
    console.log("Year range: ", yearStart, yearEnd);
  
      orders.forEach(order => {
        order.dishes.forEach(dish => {
          if (dish.dish._id.toString() === dishId && dish.preparedBy && dish.preparedBy.toString() === cookId) {
            const cookingTime = Math.floor((new Date(dish.doneByCookDate) - new Date(order.orderDate)) / 1000);
            userDishes.push({
              orderId: order._id,
              tableNumber: order.tableNumber,
              orderDate: order.orderDate,
              doneByCookDate: dish.doneByCookDate,
              cookingTime: cookingTime,
            });
  
            totalCookingTime += cookingTime;
            dishCount++;
  
            const doneByCookDate = new Date(dish.doneByCookDate);
            if (doneByCookDate >= todayStart && doneByCookDate <= todayEnd) {
              counts.today++;
            }
            if (doneByCookDate >= weekStart && doneByCookDate <= weekEnd) {
              counts.lastWeek++;
            }
            if (doneByCookDate >= monthStart && doneByCookDate <= monthEnd) {
              counts.lastMonth++;
            }
            if (doneByCookDate >= yearStart && doneByCookDate <= yearEnd) {
              counts.lastYear++;
            }
          }
        });
      });
  
      const averageCookingTime = dishCount > 0 ? totalCookingTime / dishCount : 0;
  
      res.status(200).json({
        message: 'Historia przygotowania dania przez użytkownika została pomyślnie pobrana.',
        orders: orders,
        history: userDishes,
        totalDishesPrepared: dishCount,
        averageCookingTime: averageCookingTime,
        preparationCounts: counts,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Wystąpił błąd podczas pobierania historii przygotowania dania przez użytkownika.' });
    }
  };
  

exports.getUserDishPreparationHistory2 = async (req, res, next) => {
  const { dishId, cookId } = req.params;
  console.log("dishId: " + dishId);
  console.log("cookId: " + cookId);
  
  
  try {

    const orders = await Order.find({
        "dishes.dish._id": new mongoose.Types.ObjectId(dishId),
        "dishes.preparedBy": new mongoose.Types.ObjectId(cookId),
      });
  

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: 'Nie ma takiego dania.' });
    }


    const userDishes = [];
    let totalCookingTime = 0;
    let dishCount = 0;

    orders.forEach(order => {
      order.dishes.forEach(dish => {
    
        if (dish.dish._id.toString() === dishId && dish.preparedBy && dish.preparedBy.toString() === cookId) {
          const cookingTime = Math.floor((new Date(dish.doneByCookDate) - new Date(order.orderDate)) / 1000);

        
          userDishes.push({
            orderId: order._id,
            tableNumber: order.tableNumber,
            orderDate: order.orderDate,
            doneByCookDate: dish.doneByCookDate,
            cookingTime: cookingTime,
          });

        
          totalCookingTime += cookingTime;
          dishCount++;
        }
      });
    });


    const averageCookingTime = dishCount > 0 ? totalCookingTime / dishCount : 0;

    res.status(200).json({
      message: 'Historia przygotowania dania przez użytkownika została pomyślnie pobrana.',
      orders: orders,
      history: userDishes,
      totalDishesPrepared: dishCount,
      averageCookingTime: averageCookingTime,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Wystąpił błąd podczas pobierania historii przygotowania dania przez użytkownika.' });
  }
};
