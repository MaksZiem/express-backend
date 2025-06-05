const Dish = require("../models/dish");
const Order = require("../models/order");
const Table = require("../models/table");
const mongoose = require("mongoose");

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
      note: order.note
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

    const io = req.app.get("io");
    io.emit("dishReady", {
      dishName: dish.dish.name,
      tableNumber: order.tableNumber,
      orderId: order._id,
    });

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

exports.getDishesPreparedByCookWithDateRange = async (req, res, next) => {
  const { startDate, endDate } = req.body;
  const cookId = req.params.cookId;

  if (!cookId) {
    return res.status(400).json({ message: "Cook ID is required." });
  }

  let filter = { "dishes.preparedBy": cookId };
  if (startDate && endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.orderDate = { $gte: start, $lte: end };
    } catch (err) {
      return res.status(400).json({ message: "Invalid date format." });
    }
  }

  try {
    const orders = await Order.find(filter);

    const ordersWithDishes = orders.map((order) => {
      const dishesForOrder = order.dishes
        .filter(
          (dish) => dish.preparedBy && dish.preparedBy.toString() === cookId
        )
        .map((dish) => {
          const cookingTime =
            dish.doneByCookDate && order.orderDate
              ? Math.floor(
                  (new Date(dish.doneByCookDate) - new Date(order.orderDate)) /
                    1000
                )
              : null;

          return {
            dishName: dish.dish.name,
            quantity: dish.quantity,
            status: dish.status,
            cookingTime: cookingTime,
            doneByCookDate: dish.doneByCookDate,
            orderDate: order.orderDate,
            tableNumber: order.tableNumber,
          };
        });

      return {
        orderId: order._id,
        orderDate: order.orderDate,
        tableNumber: order.tableNumber,
        totalOrderPrice: order.price,
        dishes: dishesForOrder,
      };
    });

    if (ordersWithDishes.length === 0) {
      return res.status(404).json({
        message: "No orders found for this cook within the given date range.",
      });
    }

    res.status(200).json({ orders: ordersWithDishes });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving orders." });
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
    weekStart.setUTCDate(
      currentDate.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)
    );
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(currentDate);
    weekEnd.setUTCDate(currentDate.getUTCDate() + (7 - dayOfWeek));
    weekEnd.setUTCHours(23, 59, 59, 999);

    const monthStart = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      1
    );
    const monthEnd = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const yearStart = new Date(currentDate.getUTCFullYear(), 0, 1);
    const yearEnd = new Date(
      currentDate.getUTCFullYear(),
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
    res
      .status(500)
      .json({ message: "An error occurred while retrieving dish counts." });
  }
};

exports.getCookDishesCount = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    let startDate;
    const period = req.body.period || "tydzien";
    const cookId = req.params.cookId;

    if (!mongoose.Types.ObjectId.isValid(cookId)) {
      return res.status(400).json({ message: "Invalid cook ID." });
    }

    if (period === "tydzien") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === "miesiac") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === "rok") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }

    const orders = await Order.find({
      "dishes.preparedBy": cookId,
      "dishes.doneByCookDate": { $gte: startDate, $lt: endOfToday },
    });

    let dishesCount, labels;

    if (period === "tydzien") {
      dishesCount = Array(7).fill(0);
      labels = Array(7);

      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
      }
    } else if (period === "miesiac") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      dishesCount = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      dishesCount = Array(12).fill(0);
      labels = Array.from({ length: 12 }, (_, i) =>
        new Date(
          today.getFullYear(),
          (today.getMonth() + i + 1) % 12,
          1
        ).toLocaleDateString("pl-PL", {
          month: "short",
        })
      );
    }

    orders.forEach((order) => {
      order.dishes.forEach((dish) => {
        if (dish.preparedBy && dish.preparedBy.toString() === cookId) {
          const quantity = dish.quantity;
          const dateToCheck = new Date(dish.doneByCookDate);

          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (dateToCheck - startDate) / (1000 * 60 * 60 * 24)
            );
            const dayIndex = daysAgo;
            if (dayIndex >= 0 && dayIndex < 7) {
              dishesCount[dayIndex] += quantity;
            }
          } else if (period === "miesiac") {
            const dayIndex = dateToCheck.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < dishesCount.length) {
              dishesCount[dayIndex] += quantity;
            }
          } else if (period === "rok") {
            const monthIndex =
              (dateToCheck.getMonth() - startDate.getMonth() + 12) % 12;
            if (monthIndex >= 0 && monthIndex < dishesCount.length) {
              dishesCount[monthIndex] += quantity;
            }
          }
        }
      });
    });

    res.status(200).json({
      labels,
      dishesCount,
    });
  } catch (err) {
    console.error("Error:", err);
    res
      .status(500)
      .json({ message: "Internal server error.", error: err.message });
  }
};

exports.getCookPreparationTime = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    let startDate;
    const period = req.body.period || "tydzien";
    const cookId = req.params.cookId;

    if (!mongoose.Types.ObjectId.isValid(cookId)) {
      return res.status(400).json({ message: "Invalid cook ID." });
    }

    // Ustawienie startowej daty w zależności od okresu (zgodne z getCookDishesCount)
    if (period === "tydzien") {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 6);
    } else if (period === "miesiac") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === "rok") {
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 11);
      startDate.setDate(1);
    } else {
      return res.status(400).json({
        message: "Invalid period. Choose 'tydzien', 'miesiac', or 'rok'.",
      });
    }

    const orders = await Order.find({
      "dishes.preparedBy": cookId,
      "dishes.doneByCookDate": { $gte: startDate, $lt: endOfToday },
    });

    let preparationTime, labels;

    // Przygotowanie odpowiednich tablic w zależności od okresu
    if (period === "tydzien") {
      preparationTime = Array(7).fill(0);
      labels = Array(7);
      for (let i = 0; i < 7; i++) {
        const day = new Date(startDate);
        day.setDate(startDate.getDate() + i);
        labels[i] = day.toLocaleDateString("pl-PL", { weekday: "short" });
      }
    } else if (period === "miesiac") {
      const daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0
      ).getDate();
      preparationTime = Array(daysInMonth).fill(0);
      labels = Array.from({ length: daysInMonth }, (_, i) =>
        (i + 1).toString()
      );
    } else if (period === "rok") {
      preparationTime = Array(12).fill(0);
      labels = Array.from({ length: 12 }, (_, i) =>
        new Date(
          today.getFullYear(),
          (today.getMonth() + i + 1) % 12,
          1
        ).toLocaleDateString("pl-PL", {
          month: "short",
        })
      );
    }

    orders.forEach((order) => {
      order.dishes.forEach((dish) => {
        if (dish.preparedBy && dish.preparedBy.toString() === cookId) {
          const dateToCheck = new Date(dish.doneByCookDate);
          let timeToPrepare = 0;

          if (dish.doneByCookDate && order.orderDate) {
            timeToPrepare =
              new Date(dish.doneByCookDate) - new Date(order.orderDate);
          }

          if (period === "tydzien") {
            const daysAgo = Math.floor(
              (dateToCheck - startDate) / (1000 * 60 * 60 * 24)
            );
            if (daysAgo >= 0 && daysAgo < 7) {
              preparationTime[daysAgo] += timeToPrepare;
            }
          } else if (period === "miesiac") {
            const dayIndex = dateToCheck.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < preparationTime.length) {
              preparationTime[dayIndex] += timeToPrepare;
            }
          } else if (period === "rok") {
            
            const monthIndex = (dateToCheck.getMonth() - startDate.getMonth() + 12) % 12;
            if (monthIndex >= 0 && monthIndex < preparationTime.length) {
              preparationTime[monthIndex] += timeToPrepare;
            }
          }
        }
      });
    });

    
    const preparationTimeInMinutes = preparationTime.map((time, index) => {
      let dishesCount = 0;

      orders.forEach((order) => {
        order.dishes.forEach((dish) => {
          if (dish.preparedBy && dish.preparedBy.toString() === cookId) {
            const dateToCheck = new Date(dish.doneByCookDate);
            let shouldCount = false;

            if (period === "tydzien") {
              const daysAgo = Math.floor(
                (dateToCheck - startDate) / (1000 * 60 * 60 * 24)
              );
              shouldCount = daysAgo === index;
            } else if (period === "miesiac") {
              const dayIndex = dateToCheck.getDate() - 1;
              shouldCount = dayIndex === index;
            } else if (period === "rok") {
              const monthIndex = (dateToCheck.getMonth() - startDate.getMonth() + 12) % 12;
              shouldCount = monthIndex === index;
            }

            if (shouldCount) {
              dishesCount += dish.quantity || 1;
            }
          }
        });
      });

      return dishesCount > 0 ? Math.round(time / (1000 * 60 * dishesCount)) : 0;
    });

    res.status(200).json({
      labels,
      preparationTime: preparationTimeInMinutes,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Internal server error.", error: err.message });
  }
};

exports.getDishesPreparedByCook = async (req, res, next) => {
  const cookId = req.params.cookId;
  const { startDate, endDate, dishId } = req.body;

  try {
    let dateFilter = {};
    if (startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        dateFilter = { $gte: start, $lte: end };
      } catch (err) {
        return res.status(400).json({ message: "Invalid date format." });
      }
    }

    const orders = await Order.find({
      "dishes.preparedBy": cookId,
      ...(startDate && endDate && { "dishes.doneByCookDate": dateFilter }),
    }).populate({
      path: "dishes.dish",
      model: Dish,
    });

    const dishesPreparedByCook = orders.flatMap((order) =>
      order.dishes
        .filter(
          (dish) =>
            dish.preparedBy &&
            dish.preparedBy.toString() === cookId &&
            (!startDate ||
              (dish.doneByCookDate >= new Date(startDate) &&
                dish.doneByCookDate <= new Date(endDate)))
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

    res.status(200).json({
      message: `Found ${dishesPreparedByCook.length} dishes prepared by the cook.`,
      dishes: dishesPreparedByCook,
    });
  } catch (err) {
    console.error("Error retrieving dishes prepared by cook:", err);
    res
      .status(500)
      .json({ message: "An error occurred while retrieving dishes." });
  }
};
